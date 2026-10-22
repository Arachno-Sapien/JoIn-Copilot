import React, { useState, useEffect } from 'react';

export const PrivacySettings: React.FC = () => {
  const [gmailSyncEnabled, setGmailSyncEnabled] = useState(true);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
      chrome.storage.local.get('gmail_sync_enabled', (res) => {
        if (res && res.gmail_sync_enabled !== undefined) {
          setGmailSyncEnabled(Boolean(res.gmail_sync_enabled));
        } else {
          setGmailSyncEnabled(true);
        }
      });
    }
  }, []);

  const handleToggleGmailSync = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked;
    setGmailSyncEnabled(nextVal);

    if (typeof chrome !== 'undefined') {
      if (!nextVal) {
        // Clear alarm when turned off
        if (chrome.alarms?.clear) {
          chrome.alarms.clear('gmail_sync');
        }
      } else {
        // Re-create alarm when turned on
        if (chrome.alarms?.create) {
          chrome.alarms.create('gmail_sync', { periodInMinutes: 180 });
        }
      }

      if (chrome.storage?.local?.set) {
        await chrome.storage.local.set({ gmail_sync_enabled: nextVal });
      }
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
        Privacy & Background Sync
      </h3>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
        Control automated background tasks and data synchronization.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
        <label
          htmlFor="gmail-sync-toggle"
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          <input
            id="gmail-sync-toggle"
            aria-label="Enable Gmail Sync"
            type="checkbox"
            checked={gmailSyncEnabled}
            onChange={handleToggleGmailSync}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>
              Enable Gmail Sync
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Periodically check for application updates using targeted searches on alarms.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};
