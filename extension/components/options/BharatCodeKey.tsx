import React, { useEffect, useState } from 'react';
import {
  BHARATCODE_ACCOUNT_URL,
  BHARATCODE_MODEL,
  clearApiKey,
  getApiKey,
  saveApiKey,
  type ConnectionResult,
} from '../../lib/ai/bharatcode';

type Status = { tone: 'ok' | 'error' | 'info'; text: string };

const TONE_COLOR: Record<Status['tone'], string> = { ok: '#059669', error: '#b91c1c', info: '#374151' };

const buttonStyle = (primary: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  backgroundColor: primary ? '#4f46e5' : '#ffffff',
  color: primary ? '#ffffff' : '#374151',
  border: primary ? 'none' : '1px solid #d1d5db',
  borderRadius: '6px',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '13px',
});

export const BharatCodeKey: React.FC = () => {
  const [draft, setDraft] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    getApiKey().then((key) => setHasKey(Boolean(key)));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await saveApiKey(draft);
    setDraft('');
    setHasKey(true);
    setStatus({ tone: 'info', text: 'Key saved on this device. Use Test connection to check it.' });
  };

  const remove = async () => {
    await clearApiKey();
    setHasKey(false);
    setStatus({ tone: 'info', text: 'Key removed.' });
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      // The background service worker makes the request.
      const result: ConnectionResult = await chrome.runtime.sendMessage({ type: 'BHARATCODE_TEST_CONNECTION' });
      if (result.ok) {
        setStatus({ tone: 'ok', text: `Connected. Your key can use ${BHARATCODE_MODEL}.` });
      } else {
        const id = result.requestId ? ` (request id ${result.requestId})` : '';
        setStatus({ tone: 'error', text: result.message + id });
      }
    } catch {
      setStatus({ tone: 'error', text: 'Could not run the test. Reload the extension and try again.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>BharatCode API key</h3>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 8px 0' }}>
        All AI features (resume parsing, job extraction, matching, drafting, email and scam checks) run on BharatCode
        model {BHARATCODE_MODEL} with your own key. It is stored only on this device and is sent only to BharatCode
        and to your Job Copilot backend.
      </p>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
        No key yet? Get one at{' '}
        <a href={BHARATCODE_ACCOUNT_URL} target="_blank" rel="noreferrer">
          bharatcode.ai/account
        </a>
        . It is free for students with an .ac.in or .edu.in email.
      </p>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
        <div>
          <label htmlFor="bharatcode-key" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
            {hasKey ? 'A key is saved. Paste a new one to replace it.' : 'Paste your key'}
          </label>
          <input
            id="bharatcode-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="BharatCode API key"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={!draft.trim()} style={buttonStyle(true)}>
            Store key
          </button>
          <button type="button" onClick={test} disabled={!hasKey || testing} style={buttonStyle(false)}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          {hasKey && (
            <button type="button" onClick={remove} style={buttonStyle(false)}>
              Remove key
            </button>
          )}
        </div>
        {status && (
          <p role="status" style={{ margin: 0, fontSize: '13px', color: TONE_COLOR[status.tone] }}>
            {status.text}
          </p>
        )}
      </form>
    </div>
  );
};
