import { getApiKey } from '../ai/bharatcode';
import { getBackendUrl } from '../settings';

/**
 * Calls the Job Copilot backend with the user's BharatCode key (X-BharatCode-Key).
 * It runs in the extension context that calls it: the side panel and options page,
 * or the background worker for scheduled Gmail sync. Pages call the backend
 * themselves because Chrome stops the background worker when a fetch takes more
 * than 30 seconds, and BharatCode answers can take minutes. Content scripts never
 * import this module and cannot read the key (see hideStorageFromContentScripts).
 */
export interface BackendRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  json?: unknown;
  file?: { name: string; blob: Blob };
}

export interface BackendResult {
  status: number;
  ok: boolean;
  body: unknown;
  networkError?: string;
}

export async function requestBackend(request: BackendRequest): Promise<BackendResult> {
  const baseUrl = await getBackendUrl();
  const url = `${baseUrl.replace(/\/$/, '')}/${request.endpoint.replace(/^\//, '')}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = await getApiKey();
  if (key) headers['X-BharatCode-Key'] = key;

  let body: BodyInit | undefined;
  if (request.file) {
    const form = new FormData();
    form.append('file', request.file.blob, request.file.name);
    body = form;
  } else if (request.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(request.json);
  }

  let response: Response;
  try {
    response = await fetch(url, { method: request.method, headers, body });
  } catch (err: any) {
    return { status: 0, ok: false, body: null, networkError: err?.message || 'unknown error' };
  }
  const parsed = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, body: parsed };
}
