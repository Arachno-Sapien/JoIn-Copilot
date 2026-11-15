import React, { useEffect, useState } from 'react';
import { PROVIDER_STORAGE_KEY, getProvider } from '../../lib/ai/provider';
import * as ui from '../ui';

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
    <div role="alert" style={{ ...ui.callout('warning'), margin: '12px 16px 0', padding: ui.space.md, borderRadius: ui.radius.lg, fontSize: ui.font.sm }}>
      <strong>AI features need an AI provider.</strong> Add any OpenAI-compatible API (OpenAI, OpenRouter, a local
      Ollama and others) with its base URL, model and key in the options.{' '}
      <button
        type="button"
        onClick={() => chrome.runtime.openOptionsPage()}
        style={ui.linkButton}
      >
        Open options
      </button>
    </div>
  );
};
