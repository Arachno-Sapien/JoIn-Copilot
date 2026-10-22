export interface ExtensionSettings {
  backendUrl: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  backendUrl: 'http://127.0.0.1:8000',
};

export async function getBackendUrl(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res = await chrome.storage.local.get(['backendUrl']);
    if (res && typeof res.backendUrl === 'string' && res.backendUrl.trim() !== '') {
      return res.backendUrl.trim();
    }
  }
  return DEFAULT_SETTINGS.backendUrl;
}

export async function setBackendUrl(url: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ backendUrl: url });
  }
}
