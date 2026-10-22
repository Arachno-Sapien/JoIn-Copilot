// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { requestBackend, sendToBackend } from '../../../lib/api/transport';
import { KeyNotice } from '../../../components/sidepanel/KeyNotice';

const KEY = 'bc-test-key-not-real-5678';
let store: Record<string, unknown>;

beforeEach(() => {
  store = { backendUrl: 'http://127.0.0.1:8000' };
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (k: string | string[]) => {
          const keys = Array.isArray(k) ? k : [k];
          return Object.fromEntries(keys.map((name) => [name, store[name]]));
        }),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: { sendMessage: vi.fn(), openOptionsPage: vi.fn() },
  };
});

function okFetch(body: unknown = { ok: true }) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
}

describe('sendToBackend (background worker)', () => {
  it('attaches the saved key and sends JSON to the backend', async () => {
    store.bharatcodeApiKey = KEY;
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendToBackend({ endpoint: '/jobs/extract', method: 'POST', json: { page_text: 'x' } });
    expect(result).toEqual({ status: 200, ok: true, body: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/jobs/extract');
    expect((init.headers as Record<string, string>)['X-BharatCode-Key']).toBe(KEY);
    expect(init.body).toBe(JSON.stringify({ page_text: 'x' }));
  });

  it('sends no key header when none is saved', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await sendToBackend({ endpoint: 'health', method: 'GET' });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect('X-BharatCode-Key' in (init.headers as Record<string, string>)).toBe(false);
  });

  it('rebuilds an uploaded file as multipart form data', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await sendToBackend({
      endpoint: 'profile/parse',
      method: 'POST',
      file: { name: 'resume.pdf', type: 'application/pdf', base64: btoa('%PDF-1.4') },
    });
    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('resume.pdf');
    expect(file.type).toBe('application/pdf');
    expect(file.size).toBe('%PDF-1.4'.length); // jsdom's File has no text()
  });

  it('reports a network failure instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    const result = await sendToBackend({ endpoint: 'health', method: 'GET' });
    expect(result.networkError).toBe('Failed to fetch');
  });
});

describe('requestBackend (extension pages)', () => {
  it('hands the request to the background worker instead of calling the backend', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const reply = { status: 200, ok: true, body: { done: true } };
    (globalThis as any).chrome.runtime.sendMessage.mockResolvedValue(reply);
    const request = { endpoint: 'draft', method: 'POST' as const, json: { q: 1 } };
    expect(await requestBackend(request)).toEqual(reply);
    expect((globalThis as any).chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'BACKEND_REQUEST', request });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('KeyNotice', () => {
  it('explains how to get a key when none is saved', async () => {
    render(<KeyNotice />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('bharatcode.ai/account'));
  });

  it('stays hidden once a key is saved', async () => {
    store.bharatcodeApiKey = KEY;
    const { container } = render(<KeyNotice />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe('');
  });
});
