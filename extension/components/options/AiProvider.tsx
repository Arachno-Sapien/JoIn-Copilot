import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { ApiError, apiClient } from '../../lib/api/client';
import { PROVIDER_EXAMPLES, clearProvider, getProvider, saveProvider } from '../../lib/ai/provider';

type Status = { tone: 'ok' | 'error' | 'info'; text: string };

const TONE_COLOR: Record<Status['tone'], string> = { ok: '#059669', error: '#b91c1c', info: '#374151' };
const CheckSchema = z.object({ ok: z.literal(true), model: z.string() });

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
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' };

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

/**
 * Runs in the options page, not the background worker: the backend asks the model,
 * and a slow answer can outlast the 30 seconds after which Chrome stops the worker.
 */
async function testConnection(): Promise<Status> {
  try {
    const { model } = await apiClient.post('llm/check', {}, CheckSchema);
    return { tone: 'ok', text: `Connected. ${model} answered with structured output.` };
  } catch (err) {
    if (err instanceof ApiError && err.status === undefined) {
      return { tone: 'error', text: 'Could not reach the Job Copilot backend. Check that it is running and its URL below.' };
    }
    const detail = err instanceof ApiError && err.detail ? ` ${err.detail}` : '';
    return { tone: 'error', text: `${err instanceof Error ? err.message : 'Test failed'}.${detail}` };
  }
}

export const AiProvider: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    getProvider().then((provider) => {
      if (!provider) return;
      setBaseUrl(provider.baseUrl);
      setModel(provider.model);
      setSavedKey(provider.apiKey);
      setSaved(true);
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHttpUrl(baseUrl)) {
      setStatus({ tone: 'error', text: 'The base URL must start with http:// or https://.' });
      return;
    }
    const apiKey = keyDraft.trim() || savedKey;
    await saveProvider({ baseUrl, model, apiKey });
    setSavedKey(apiKey);
    setKeyDraft('');
    setSaved(true);
    setStatus({ tone: 'info', text: 'Saved on this device. Use Test connection to check it.' });
  };

  const remove = async () => {
    await clearProvider();
    setBaseUrl('');
    setModel('');
    setSavedKey('');
    setKeyDraft('');
    setSaved(false);
    setStatus({ tone: 'info', text: 'Provider settings removed.' });
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    setStatus(await testConnection());
    setTesting(false);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>AI provider</h3>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 8px 0' }}>
        All AI features (resume parsing, job extraction, matching, drafting, email and scam checks) run on the
        OpenAI-compatible provider and model you choose, with your own key. These settings are stored only on this
        device and are sent only to your Job Copilot backend, which calls the provider. Pick a model that supports
        structured (JSON schema) output.
      </p>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
        Examples:{' '}
        {PROVIDER_EXAMPLES.map((example, i) => (
          <React.Fragment key={example.name}>
            {i > 0 && ' · '}
            <button
              type="button"
              onClick={() => setBaseUrl(example.baseUrl)}
              style={{ border: 'none', background: 'none', padding: 0, color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}
            >
              {example.name}
            </button>
          </React.Fragment>
        ))}
      </p>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
        <div>
          <label htmlFor="llm-base-url" style={labelStyle}>Base URL</label>
          <input
            id="llm-base-url"
            type="url"
            spellCheck={false}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={PROVIDER_EXAMPLES[0].baseUrl}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="llm-model" style={labelStyle}>Model</label>
          <input
            id="llm-model"
            type="text"
            spellCheck={false}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="The model id your provider lists"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="llm-key" style={labelStyle}>
            {savedKey ? 'API key (one is saved; paste a new one to replace it)' : 'API key (leave empty if your provider needs none)'}
          </label>
          <input
            id="llm-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="API key"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={!baseUrl.trim() || !model.trim()} style={buttonStyle(true)}>
            Store provider
          </button>
          <button type="button" onClick={test} disabled={!saved || testing} style={buttonStyle(false)}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          {saved && (
            <button type="button" onClick={remove} style={buttonStyle(false)}>
              Remove
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
