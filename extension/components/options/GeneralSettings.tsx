import React, { useState, useEffect } from 'react';
import { getBackendUrl, setBackendUrl } from '../../lib/settings';
import * as ui from '../ui';

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
    <div style={{ ...ui.card, padding: ui.space.xl }}>
      <h3 style={ui.h3}>
        Backend Connection
      </h3>
      <p style={ui.bodyText}>
        Configure the local or remote Job Copilot backend server.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: ui.space.md, maxWidth: '500px' }}>
        <div>
          <label htmlFor="backend-url" style={ui.label}>
            Backend URL
          </label>
          <input
            id="backend-url"
            aria-label="Backend URL"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8000"
            style={ui.input}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: ui.space.md }}>
          <button
            type="submit"
            style={ui.primaryButton}
          >
            Save Settings
          </button>
          {saved && <span style={ui.successText}>Saved!</span>}
        </div>
      </form>
    </div>
  );
};
