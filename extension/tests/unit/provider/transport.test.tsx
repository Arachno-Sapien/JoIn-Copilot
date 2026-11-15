// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { requestBackend } from '../../../lib/api/transport';
import { KeyNotice } from '../../../components/sidepanel/KeyNotice';
import { AiProvider } from '../../../components/options/AiProvider';

const KEY = 'test-key-not-real-5678';
const PROVIDER = { baseUrl: 'https://llm.example.test/v1', model: 'example-model', apiKey: KEY };
let store: Record<string, unknown>;

afterEach(cleanup);

beforeEach(() => {
  store = { backendUrl: 'http://127.0.0.1:8000' };
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (k: string | string[]) => {
          const keys = Array.isArray(k) ? k : [k];
          return Object.fromEntries(keys.map((name) => [name, store[name]]));
        }),
        set: vi.fn(async (items: Record<string, unknown>) => Object.assign(store, items)),
        remove: vi.fn(async (k: string) => {
          delete store[k];
        }),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: { sendMessage: vi.fn(), openOptionsPage: vi.fn() },
  };
});

function reply(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const sentHeaders = (fetchMock: ReturnType<typeof vi.fn>) =>
  (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;

// Chrome stops the background worker when a fetch takes over 30 seconds, and
// model answers can take minutes, so extension pages call the backend themselves.
describe('requestBackend', () => {
  it('calls the backend itself with the provider headers, not through the background worker', async () => {
    store.aiProvider = PROVIDER;
    const fetchMock = reply({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const result = await requestBackend({ endpoint: '/jobs/extract', method: 'POST', json: { page_text: 'x' } });
    expect(result).toEqual({ status: 200, ok: true, body: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/jobs/extract');
    expect(sentHeaders(fetchMock)).toMatchObject({
      'X-LLM-Base-URL': PROVIDER.baseUrl,
      'X-LLM-Model': PROVIDER.model,
      'X-LLM-Key': KEY,
    });
    expect(init.body).toBe(JSON.stringify({ page_text: 'x' }));
    expect((globalThis as any).chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('sends no provider headers when none is set up, and no key header when the key is empty', async () => {
    const fetchMock = reply({});
    vi.stubGlobal('fetch', fetchMock);
    await requestBackend({ endpoint: 'health', method: 'GET' });
    expect(Object.keys(sentHeaders(fetchMock)).filter((h) => h.startsWith('X-LLM'))).toEqual([]);

    store.aiProvider = { ...PROVIDER, apiKey: '' };
    fetchMock.mockClear();
    await requestBackend({ endpoint: 'health', method: 'GET' });
    expect('X-LLM-Model' in sentHeaders(fetchMock)).toBe(true);
    expect('X-LLM-Key' in sentHeaders(fetchMock)).toBe(false);
  });

  it('uploads a file as multipart form data', async () => {
    const fetchMock = reply({});
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

describe('AiProvider', () => {
  async function clickTest() {
    const button = screen.getByRole('button', { name: 'Test connection' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
  }

  it('runs Test connection through the backend from the options page, not the background worker', async () => {
    store.aiProvider = PROVIDER;
    const fetchMock = reply({ ok: true, model: PROVIDER.model });
    vi.stubGlobal('fetch', fetchMock);
    render(<AiProvider />);
    await clickTest();
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Connected. example-model'));
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('http://127.0.0.1:8000/llm/check');
    expect(sentHeaders(fetchMock)['X-LLM-Key']).toBe(KEY);
    expect((globalThis as any).chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("shows the backend's error and detail when the test fails", async () => {
    store.aiProvider = PROVIDER;
    vi.stubGlobal('fetch', reply({ error: 'The AI provider rejected the API key', detail: 'Check the key.' }, 401));
    render(<AiProvider />);
    await clickTest();
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('The AI provider rejected the API key. Check the key.')
    );
  });

  it('saves the settings and keeps the saved key when the key field is left empty', async () => {
    store.aiProvider = PROVIDER;
    render(<AiProvider />);
    const model = screen.getByLabelText('Model') as HTMLInputElement;
    await waitFor(() => expect(model.value).toBe(PROVIDER.model));
    fireEvent.change(model, { target: { value: 'other-model' } });
    fireEvent.click(screen.getByRole('button', { name: 'Store provider' }));
    await waitFor(() => expect(store.aiProvider).toEqual({ ...PROVIDER, model: 'other-model' }));
  });

  it('refuses a base URL that is not http or https', async () => {
    render(<AiProvider />);
    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'file:///etc' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'example-model' } });
    fireEvent.click(screen.getByRole('button', { name: 'Store provider' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('http:// or https://'));
    expect(store.aiProvider).toBeUndefined();
  });
});

describe('KeyNotice', () => {
  it('explains what to set up when no provider is saved', async () => {
    render(<KeyNotice />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('OpenAI-compatible'));
  });

  it('stays hidden once a provider is saved', async () => {
    store.aiProvider = PROVIDER;
    const { container } = render(<KeyNotice />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe('');
  });
});
