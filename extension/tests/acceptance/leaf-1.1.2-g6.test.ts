import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { apiClient, ApiError } from '../../lib/api/client';

describe('leaf-1.1.2:G6 API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Setup chrome.storage.local mock
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockImplementation((keys: any, cb?: any) => {
            const result = { backendUrl: 'http://127.0.0.1:8000' };
            if (typeof cb === 'function') cb(result);
            return Promise.resolve(result);
          }),
          set: vi.fn().mockImplementation((items: any, cb?: any) => {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }),
        },
      },
    };
  });

  const SampleSchema = z.object({
    status: z.string(),
  });

  it('validates successful response with Zod', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await apiClient.get('/health', SampleSchema);
    expect(res.status).toBe('ok');
  });

  it('raises typed ApiError on server error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not Found', detail: 'Resource missing' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiClient.get('/unknown', SampleSchema)).rejects.toThrow(ApiError);
  });

  it('raises typed ApiError on schema mismatch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ wrongField: 123 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiClient.get('/health', SampleSchema)).rejects.toThrow(ApiError);
  });

  it('raises typed ApiError on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

    await expect(apiClient.get('/health', SampleSchema)).rejects.toThrow(ApiError);
  });
});
