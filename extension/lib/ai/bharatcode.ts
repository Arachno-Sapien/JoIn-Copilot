/**
 * BharatCode settings for the extension (https://bharatcode.ai/build).
 *
 * The user's own key lives only in chrome.storage.local: never in sync storage,
 * the bundle, logs or git. The background service worker is the only place that
 * sends it anywhere: to BharatCode for the connection test, and to the backend
 * (X-BharatCode-Key header) which makes the model calls.
 */

export const BHARATCODE_BASE_URL = 'https://bharatcode.ai/api/model/v1';
export const BHARATCODE_MODEL = 'qwen-3.8-27b';
export const BHARATCODE_ACCOUNT_URL = 'https://bharatcode.ai/account';
export const KEY_HELP =
  'Get a key at bharatcode.ai/account. It is free for students with an .ac.in or .edu.in email.';

const STORAGE_KEY = 'bharatcodeApiKey';
const BUSY_RETRY_DELAYS_MS = [2000, 4000, 8000];

export async function getApiKey(): Promise<string | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const key = stored?.[STORAGE_KEY];
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

export async function saveApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) return clearApiKey();
  await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export type ConnectionResult =
  | { ok: true; modelAvailable: boolean }
  | { ok: false; message: string; requestId?: string | null };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** GET /models with the saved key. Runs in the background service worker. */
export async function testConnection(
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = wait
): Promise<ConnectionResult> {
  const key = await getApiKey();
  if (!key) return { ok: false, message: `No BharatCode key saved. ${KEY_HELP}` };

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(`${BHARATCODE_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
    } catch {
      return { ok: false, message: 'Could not reach BharatCode. Check your connection.' };
    }

    const requestId = response.headers.get('x-request-id');
    if (response.status === 503 && attempt < BUSY_RETRY_DELAYS_MS.length) {
      await sleep(BUSY_RETRY_DELAYS_MS[attempt]);
      continue;
    }
    if (response.ok) {
      const body = await response.json().catch(() => null);
      const ids = Array.isArray(body?.data) ? body.data.map((m: { id?: string }) => m?.id) : [];
      return { ok: true, modelAvailable: ids.includes(BHARATCODE_MODEL) };
    }

    console.warn(`BharatCode /models failed: HTTP ${response.status}, x-request-id=${requestId}`);
    if (response.status === 503) return { ok: false, message: 'BharatCode is busy, try again.', requestId };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: `BharatCode rejected this key. ${KEY_HELP}`, requestId };
    }
    return { ok: false, message: `BharatCode returned HTTP ${response.status}.`, requestId };
  }
}
