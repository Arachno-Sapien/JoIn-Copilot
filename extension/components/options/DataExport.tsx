import React, { useState } from 'react';
import { exportDataAsJson, exportDataAsCsv, deleteAllUserData } from '../../lib/export';

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
    <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
        Data Management & Export
      </h3>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
        Export your data in standard formats or delete all local data stored in the browser.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={handleExportJson}
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
            Export as JSON
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
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
            Export as CSV
          </button>
        </div>

        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px', marginTop: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#b91c1c', marginBottom: '6px' }}>
            Danger Zone
          </div>
          <button
            type="button"
            onClick={handleDeleteAll}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Delete All Data
          </button>
        </div>

        {status && (
          <div style={{ fontSize: '13px', color: '#374151', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};
