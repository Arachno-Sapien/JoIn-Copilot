import React, { useState, useEffect } from 'react';
import * as ui from '../ui';

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
    <div style={{ ...ui.card, padding: ui.space.xl }}>
      <h3 style={ui.h3}>
        Privacy & Background Sync
      </h3>
      <p style={ui.bodyText}>
        Control automated background tasks and data synchronization.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.lg, maxWidth: '500px' }}>
        <label
          htmlFor="gmail-sync-toggle"
          style={{ display: 'flex', alignItems: 'center', gap: ui.space.md, cursor: 'pointer' }}
        >
          <input
            id="gmail-sync-toggle"
            aria-label="Enable Gmail Sync"
            type="checkbox"
            checked={gmailSyncEnabled}
            onChange={handleToggleGmailSync}
            style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0, accentColor: ui.color.primary }}
          />
          <div>
            <div style={{ fontSize: ui.font.lg, fontWeight: 500, color: ui.color.text }}>
              Enable Gmail Sync
            </div>
            <div style={{ fontSize: ui.font.sm, color: ui.color.textMuted }}>
              Periodically check for application updates using targeted searches on alarms.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};
