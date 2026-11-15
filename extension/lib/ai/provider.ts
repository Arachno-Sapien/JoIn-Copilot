/**
 * The user's AI provider: any OpenAI-compatible API (base URL, model, optional key).
 *
 * The settings live only in chrome.storage.local: never in sync storage, the bundle,
 * logs or git. Extension pages and the background worker send them to the backend
 * (X-LLM-Base-URL, X-LLM-Model and X-LLM-Key headers), which makes the model calls.
 * Content scripts cannot read them.
 */

export interface ProviderSettings {
  baseUrl: string;
  model: string;
  apiKey: string; // empty for local servers that need none
}

export const PROVIDER_STORAGE_KEY = 'aiProvider';

export const PROVIDER_EXAMPLES = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { name: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
];

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The saved provider, or null until both a base URL and a model are set. */
export async function getProvider(): Promise<ProviderSettings | null> {
  const stored = (await chrome.storage.local.get(PROVIDER_STORAGE_KEY))?.[PROVIDER_STORAGE_KEY];
  const baseUrl = text(stored?.baseUrl).replace(/\/+$/, '');
  const model = text(stored?.model);
  return baseUrl && model ? { baseUrl, model, apiKey: text(stored?.apiKey) } : null;
}

export async function saveProvider(settings: ProviderSettings): Promise<void> {
  const value = {
    baseUrl: text(settings.baseUrl).replace(/\/+$/, ''),
    model: text(settings.model),
    apiKey: text(settings.apiKey),
  };
  await chrome.storage.local.set({ [PROVIDER_STORAGE_KEY]: value });
}

export async function clearProvider(): Promise<void> {
  await chrome.storage.local.remove(PROVIDER_STORAGE_KEY);
}

/** Background worker, at startup: content scripts never need extension storage, so keep the key out of reach. */
export async function hideStorageFromContentScripts(): Promise<void> {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}
