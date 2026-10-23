// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { requestBackend } from '../../../lib/api/transport';
import { KeyNotice } from '../../../components/sidepanel/KeyNotice';
import { BharatCodeKey } from '../../../components/options/BharatCodeKey';

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

// Chrome stops the background worker when a fetch takes over 30 seconds, and
// BharatCode answers take minutes, so extension pages call the backend themselves.
describe('requestBackend', () => {
  it('calls the backend itself with the saved key, not through the background worker', async () => {
    store.bharatcodeApiKey = KEY;
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const result = await requestBackend({ endpoint: '/jobs/extract', method: 'POST', json: { page_text: 'x' } });
    expect(result).toEqual({ status: 200, ok: true, body: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/jobs/extract');
    expect((init.headers as Record<string, string>)['X-BharatCode-Key']).toBe(KEY);
    expect(init.body).toBe(JSON.stringify({ page_text: 'x' }));
    expect((globalThis as any).chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('sends no key header when none is saved', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await requestBackend({ endpoint: 'health', method: 'GET' });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect('X-BharatCode-Key' in (init.headers as Record<string, string>)).toBe(false);
  });

  it('uploads a file as multipart form data', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    await requestBackend({
      endpoint: 'profile/parse',
      method: 'POST',
      file: { name: 'resume.pdf', blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) },
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
    const result = await requestBackend({ endpoint: 'health', method: 'GET' });
    expect(result.networkError).toBe('Failed to fetch');
  });
});

describe('BharatCodeKey', () => {
  it('runs Test connection in the options page, not the background worker', async () => {
    store.bharatcodeApiKey = KEY;
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.endsWith('/models') ? { data: [{ id: 'qwen-3.8-27b' }] } : {}), { status: 200 })
    ));
    render(<BharatCodeKey />);
    const button = screen.getByRole('button', { name: 'Test connection' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Connected'));
    expect((globalThis as any).chrome.runtime.sendMessage).not.toHaveBeenCalled();
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
