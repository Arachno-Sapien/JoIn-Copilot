import { getApiKey } from '../ai/bharatcode';
import { getBackendUrl } from '../settings';

/**
 * Every call to the Job Copilot backend runs in the background service worker,
 * which attaches the user's BharatCode key (X-BharatCode-Key) for that request.
 * Extension pages never fetch the backend or read the key themselves.
 */
export interface BackendRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  json?: unknown;
  // Extension messages cannot carry a Blob, so uploads travel as base64.
  file?: { name: string; type: string; base64: string };
}

export interface BackendResult {
  status: number;
  ok: boolean;
  body: unknown;
  networkError?: string;
}

/** Background worker only: call the backend with the saved key. */
export async function sendToBackend(request: BackendRequest): Promise<BackendResult> {
  const baseUrl = await getBackendUrl();
  const url = `${baseUrl.replace(/\/$/, '')}/${request.endpoint.replace(/^\//, '')}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = await getApiKey();
  if (key) headers['X-BharatCode-Key'] = key;

  let body: BodyInit | undefined;
  if (request.file) {
    const form = new FormData();
    form.append('file', base64ToBlob(request.file.base64, request.file.type), request.file.name);
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

/** From any extension page: hand the request to the background worker. */
export async function requestBackend(request: BackendRequest): Promise<BackendResult> {
  const inPage = typeof window !== 'undefined';
  if (inPage && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return chrome.runtime.sendMessage({ type: 'BACKEND_REQUEST', request });
  }
  // Already in the background worker, or a test without extension messaging.
  return sendToBackend(request);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
