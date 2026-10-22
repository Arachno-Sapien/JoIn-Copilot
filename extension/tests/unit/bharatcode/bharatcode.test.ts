import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BHARATCODE_BASE_URL,
  clearApiKey,
  getApiKey,
  saveApiKey,
  testConnection,
} from '../../../lib/ai/bharatcode';

const KEY = 'bc-test-key-not-real-1234';
let store: Record<string, unknown>;

beforeEach(() => {
  store = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (k: string) => ({ [k]: store[k] })),
        set: vi.fn(async (items: Record<string, unknown>) => Object.assign(store, items)),
        remove: vi.fn(async (k: string) => {
          delete store[k];
        }),
      },
      // No sync storage: the key must never be written there.
    },
  };
});

function respond(status: number, body: unknown = {}, requestId = 'req-1') {
  return new Response(JSON.stringify(body), { status, headers: { 'x-request-id': requestId } });
}

describe('BharatCode key storage', () => {
  it('saves the trimmed key to chrome.storage.local only', async () => {
    await saveApiKey(`  ${KEY}  `);
    expect(await getApiKey()).toBe(KEY);
    expect(Object.values(store)).toEqual([KEY]);
  });

  it('removes the key', async () => {
    await saveApiKey(KEY);
    await clearApiKey();
    expect(await getApiKey()).toBeNull();
  });

  it('treats a blank key as no key', async () => {
    await saveApiKey('   ');
    expect(await getApiKey()).toBeNull();
  });
});

describe('testConnection', () => {
  it('explains how to get a key when none is saved, without a request', async () => {
    const fetchImpl = vi.fn();
    const result = await testConnection(fetchImpl);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('bharatcode.ai/account');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('calls GET /models with the key and reports whether qwen-3.8-27b is available', async () => {
    await saveApiKey(KEY);
    const fetchImpl = vi.fn(async () => respond(200, { data: [{ id: 'qwen-3.8-27b' }] }));
    expect(await testConnection(fetchImpl)).toEqual({ ok: true, modelAvailable: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BHARATCODE_BASE_URL}/models`);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  it('reports a rejected key', async () => {
    await saveApiKey(KEY);
    const result = await testConnection(vi.fn(async () => respond(401)));
    expect(!result.ok && result.message).toMatch(/rejected/i);
  });

  it('retries a busy service after 2, 4 and 8 seconds', async () => {
    await saveApiKey(KEY);
    const waits: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200, { data: [{ id: 'qwen-3.8-27b' }] }));
    const result = await testConnection(fetchImpl, async (ms) => {
      waits.push(ms);
    });
    expect(result.ok).toBe(true);
    expect(waits).toEqual([2000, 4000, 8000]);
  });

  it('says BharatCode is busy after the retries, logging the request id but never the key', async () => {
    await saveApiKey(KEY);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await testConnection(vi.fn(async () => respond(503, {}, 'req-busy')), async () => {});
    expect(result).toEqual({ ok: false, message: 'BharatCode is busy, try again.', requestId: 'req-busy' });
    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).toContain('req-busy');
    expect(logged).not.toContain(KEY);
    warn.mockRestore();
  });
});
