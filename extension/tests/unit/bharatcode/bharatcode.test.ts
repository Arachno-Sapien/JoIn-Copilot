import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BHARATCODE_BASE_URL,
  clearApiKey,
  getApiKey,
  hideStorageFromContentScripts,
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

const MODELS = { data: [{ id: 'qwen-3.8-27b' }, { id: 'deepseek-v4.1-flash' }] };

/** Live BharatCode answers GET /models with 200 for any key, so only POST /responses tells keys apart. */
function bharatcode(responsesStatus: number, models: unknown = MODELS) {
  return vi.fn(async (url: string) =>
    url.endsWith('/models') ? respond(200, models) : respond(responsesStatus, {}, 'req-responses')
  );
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

  it('keeps content scripts from reading chrome.storage.local, where the key lives', async () => {
    const setAccessLevel = vi.fn(async () => {});
    (globalThis as any).chrome.storage.local.setAccessLevel = setAccessLevel;
    await hideStorageFromContentScripts();
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
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

  it('checks GET /models, then makes a tiny stateless POST /responses call with the key', async () => {
    await saveApiKey(KEY);
    const fetchImpl = bharatcode(200);
    expect(await testConnection(fetchImpl)).toEqual({ ok: true });

    const [modelsUrl, modelsInit] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(modelsUrl).toBe(`${BHARATCODE_BASE_URL}/models`);
    expect((modelsInit.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);

    const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe(`${BHARATCODE_BASE_URL}/responses`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('qwen-3.8-27b');
    expect(body.store).toBe(false);
    // Live BharatCode queues requests: only a stream sends the status before the answer is done.
    expect(body.stream).toBe(true);
    expect(body.reasoning).toEqual({ effort: 'none' });
    expect(body.max_output_tokens).toBeLessThanOrEqual(16);
    expect(Object.keys(body)).not.toContain('tools');
  });

  it('reports a rejected key, which only POST /responses detects', async () => {
    await saveApiKey(KEY);
    const result = await testConnection(bharatcode(401));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/rejected/i);
  });

  it('explains how to get access when the plan has no API use (402)', async () => {
    await saveApiKey(KEY);
    const result = await testConnection(bharatcode(402));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/no API access/i);
    expect(!result.ok && result.message).toContain('bharatcode.ai/account');
    expect(!result.ok && result.requestId).toBe('req-responses');
  });

  it('stops before the model call when qwen-3.8-27b is not listed', async () => {
    await saveApiKey(KEY);
    const fetchImpl = bharatcode(200, { data: [{ id: 'some-other-model' }] });
    const result = await testConnection(fetchImpl);
    expect(!result.ok && result.message).toContain('qwen-3.8-27b');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a busy model call after 2, 4 and 8 seconds', async () => {
    await saveApiKey(KEY);
    const waits: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(respond(200, MODELS))
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200));
    const result = await testConnection(fetchImpl, async (ms) => {
      waits.push(ms);
    });
    expect(result).toEqual({ ok: true });
    expect(waits).toEqual([2000, 4000, 8000]);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
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
