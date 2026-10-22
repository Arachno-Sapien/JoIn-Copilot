import React, { useEffect, useState } from 'react';
import { BHARATCODE_ACCOUNT_URL, getApiKey } from '../../lib/ai/bharatcode';

/** Shown in the side panel while no BharatCode key is saved. */
export const KeyNotice: React.FC = () => {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const refresh = () => getApiKey().then((key) => setMissing(!key)).catch(() => setMissing(false));
    refresh();
    const onChange = (changes: Record<string, unknown>) => {
      if ('bharatcodeApiKey' in changes) refresh();
    };
    chrome.storage.onChanged?.addListener(onChange);
    return () => chrome.storage.onChanged?.removeListener(onChange);
  }, []);

  if (!missing) return null;
  return (
    <div role="alert" style={{ margin: '12px 16px 0', padding: '12px', borderRadius: '8px', border: '1px solid #fcd34d', backgroundColor: '#fffbeb', fontSize: '12px', color: '#78350f' }}>
      <strong>AI features need your BharatCode API key.</strong> Get one at{' '}
      <a href={BHARATCODE_ACCOUNT_URL} target="_blank" rel="noreferrer">
        bharatcode.ai/account
      </a>{' '}
      (free for students with an .ac.in or .edu.in email), then paste it in the options.{' '}
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
