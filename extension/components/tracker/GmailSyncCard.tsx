import React, { useState, useEffect } from 'react';
import { getGmailAuthToken } from '../../lib/gmail-auth';
import { syncGmail, getLastSyncTime } from '../../lib/gmail';
import * as ui from '../ui';

export interface GmailSyncCardProps {
  onSyncComplete?: (updatedCount: number) => void;
}

export const GmailSyncCard: React.FC<GmailSyncCardProps> = ({ onSyncComplete }) => {
  const [hasDummyClientId, setHasDummyClientId] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const manifest = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()) || {};
    const clientId = (manifest as any)?.oauth2?.client_id || '';
    if (!clientId || clientId.includes('dummy-client-id')) {
      setHasDummyClientId(true);
      return;
    }

    getLastSyncTime().then(setLastSync);

    getGmailAuthToken(false)
      .then(() => setHasToken(true))
      .catch(() => setHasToken(false));
  }, []);

  const handleConnect = async () => {
    setSyncing(true);
    setError(null);
    try {
      await getGmailAuthToken(true);
      setHasToken(true);
      const time = await getLastSyncTime();
      setLastSync(time);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Gmail');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const result = await syncGmail();
      const count = result.updatedCount;
      setSyncMessage(count === 1 ? '1 application updated' : `${count} applications updated`);
      const time = await getLastSyncTime();
      setLastSync(time);
      if (onSyncComplete) {
        onSyncComplete(count);
      }
    } catch (err: any) {
      setError(err?.message || 'Gmail sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (hasDummyClientId) {
    return (
      <div
        data-testid="gmail-sync-card"
        style={{
          ...ui.card,
          padding: ui.space.md,
          backgroundColor: ui.color.surface,
          border: `1px solid ${ui.color.border}`,
          borderRadius: ui.radius.md,
          marginBottom: ui.space.md,
        }}
      >
        <p style={{ margin: 0, fontSize: ui.font.sm, color: ui.color.textMuted }}>
          Gmail sync requires setting up a Google OAuth client ID in docs/guide/setup.md.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="gmail-sync-card"
      style={{
        ...ui.card,
        padding: ui.space.md,
        backgroundColor: ui.color.surface,
        border: `1px solid ${ui.color.border}`,
        borderRadius: ui.radius.md,
        marginBottom: ui.space.md,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: ui.space.sm }}>
        <div>
          <h4 style={{ ...ui.h4, margin: 0, fontSize: ui.font.md }}>Gmail Sync</h4>
          <div style={{ fontSize: ui.font.xs, color: ui.color.textMuted, marginTop: '2px' }}>
            {lastSync ? `Last synced: ${lastSync.toLocaleTimeString()}` : 'Never synced'}
          </div>
        </div>

        <div>
          {!hasToken ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={syncing}
              style={{ ...ui.primaryButton, padding: '5px 12px', fontSize: ui.font.xs }}
            >
              {syncing ? 'Connecting...' : 'Connect Gmail'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              style={{ ...ui.secondaryButton, padding: '5px 12px', fontSize: ui.font.xs }}
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </div>
      </div>

      {syncMessage && (
        <div style={{ color: ui.color.success, fontSize: ui.font.xs, marginTop: ui.space.xs, fontWeight: 500 }}>
          {syncMessage}
        </div>
      )}

      {error && (
        <div role="alert" style={{ ...ui.errorText, fontSize: ui.font.xs, marginTop: ui.space.xs }}>
          {error}
        </div>
      )}
    </div>
  );
};
