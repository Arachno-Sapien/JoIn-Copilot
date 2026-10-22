import React, { useState, useEffect } from 'react';
import { getBackendUrl, setBackendUrl } from '../../lib/settings';

export const GeneralSettings: React.FC = () => {
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getBackendUrl().then(setUrl);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await setBackendUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
        Backend Connection
      </h3>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
        Configure the local or remote Job Copilot backend server.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
        <div>
          <label htmlFor="backend-url" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
            Backend URL
          </label>
          <input
            id="backend-url"
            aria-label="Backend URL"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8000"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Save Settings
          </button>
          {saved && <span style={{ fontSize: '13px', color: '#059669' }}>Saved!</span>}
        </div>
      </form>
    </div>
  );
};
