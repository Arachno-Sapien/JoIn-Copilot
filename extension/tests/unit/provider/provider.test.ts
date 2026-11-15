import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearProvider,
  getProvider,
  hideStorageFromContentScripts,
  saveProvider,
} from '../../../lib/ai/provider';

const KEY = 'test-key-not-real-1234';
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

describe('AI provider settings', () => {
  it('saves trimmed settings to chrome.storage.local only, without a trailing slash', async () => {
    await saveProvider({ baseUrl: ' https://llm.example.test/v1/ ', model: ' example-model ', apiKey: `  ${KEY}  ` });
    expect(await getProvider()).toEqual({ baseUrl: 'https://llm.example.test/v1', model: 'example-model', apiKey: KEY });
    expect(Object.keys(store)).toEqual(['aiProvider']);
  });

  it('allows an empty key for local servers', async () => {
    await saveProvider({ baseUrl: 'http://localhost:11434/v1', model: 'local-model', apiKey: '' });
    expect((await getProvider())?.apiKey).toBe('');
  });

  it('is not set up without both a base URL and a model', async () => {
    expect(await getProvider()).toBeNull();
    await saveProvider({ baseUrl: 'https://llm.example.test/v1', model: '  ', apiKey: KEY });
    expect(await getProvider()).toBeNull();
  });

  it('removes the settings', async () => {
    await saveProvider({ baseUrl: 'https://llm.example.test/v1', model: 'example-model', apiKey: KEY });
    await clearProvider();
    expect(await getProvider()).toBeNull();
  });

  it('keeps content scripts from reading chrome.storage.local, where the key lives', async () => {
    const setAccessLevel = vi.fn(async () => {});
    (globalThis as any).chrome.storage.local.setAccessLevel = setAccessLevel;
    await hideStorageFromContentScripts();
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
  });
});
