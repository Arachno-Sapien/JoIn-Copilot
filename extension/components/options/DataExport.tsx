import React, { useState } from 'react';
import { exportDataAsJson, exportDataAsCsv, deleteAllUserData } from '../../lib/export';
import * as ui from '../ui';

export const DataExport: React.FC = () => {
  const [status, setStatus] = useState<string | null>(null);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = async () => {
    try {
      const json = await exportDataAsJson();
      downloadFile(json, `job-copilot-export-${new Date().toISOString().substring(0, 10)}.json`, 'application/json');
      setStatus('Exported JSON successfully!');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus(`Failed to export JSON: ${err?.message}`);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await exportDataAsCsv();
      downloadFile(csv, `job-copilot-applications-${new Date().toISOString().substring(0, 10)}.csv`, 'text/csv');
      setStatus('Exported CSV successfully!');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus(`Failed to export CSV: ${err?.message}`);
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL data? This action cannot be undone.')) {
      try {
        await deleteAllUserData();
        setStatus('All local data and settings have been deleted.');
        setTimeout(() => setStatus(null), 4000);
      } catch (err: any) {
        setStatus(`Failed to delete data: ${err?.message}`);
      }
    }
  };

  return (
    <div style={{ ...ui.card, padding: ui.space.xl }}>
      <h3 style={ui.h3}>
        Data Management & Export
      </h3>
      <p style={ui.bodyText}>
        Export your data in standard formats or delete all local data stored in the browser.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.lg, maxWidth: '500px' }}>
        <div style={{ display: 'flex', gap: ui.space.md, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportJson}
            style={ui.primaryButton}
          >
            Export as JSON
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            style={ui.primaryButton}
          >
            Export as CSV
          </button>
        </div>

        <div style={{ borderTop: `1px solid ${ui.color.border}`, paddingTop: ui.space.lg }}>
          <div style={{ ...ui.h4, color: ui.color.danger }}>
            Danger Zone
          </div>
          <button
            type="button"
            onClick={handleDeleteAll}
            style={ui.dangerButton}
          >
            Delete All Data
          </button>
        </div>

        {status && (
          <div role="status" style={{ ...ui.statusText, padding: ui.space.sm, backgroundColor: ui.color.bg, borderRadius: ui.radius.sm }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};
