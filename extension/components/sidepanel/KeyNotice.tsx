import React, { useEffect, useState } from 'react';
import { PROVIDER_STORAGE_KEY, getProvider } from '../../lib/ai/provider';

/** Shown in the side panel until an AI provider is set up. */
export const KeyNotice: React.FC = () => {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const refresh = () => getProvider().then((p) => setMissing(!p)).catch(() => setMissing(false));
    refresh();
    const onChange = (changes: Record<string, unknown>) => {
      if (PROVIDER_STORAGE_KEY in changes) refresh();
    };
    chrome.storage.onChanged?.addListener(onChange);
    return () => chrome.storage.onChanged?.removeListener(onChange);
  }, []);

  if (!missing) return null;
  return (
    <div role="alert" style={{ margin: '12px 16px 0', padding: '12px', borderRadius: '8px', border: '1px solid #fcd34d', backgroundColor: '#fffbeb', fontSize: '12px', color: '#78350f' }}>
      <strong>AI features need an AI provider.</strong> Add any OpenAI-compatible API (OpenAI, OpenRouter, a local
      Ollama and others) with its base URL, model and key in the options.{' '}
      <button
        type="button"
        onClick={() => chrome.runtime.openOptionsPage()}
        style={{ border: 'none', background: 'none', padding: 0, color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}
      >
        Open options
      </button>
    </div>
  );
};
