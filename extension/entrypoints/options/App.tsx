import React from 'react';
import { BharatCodeKey } from '../../components/options/BharatCodeKey';
import { GeneralSettings } from '../../components/options/GeneralSettings';
import { PrivacySettings } from '../../components/options/PrivacySettings';
import { DataExport } from '../../components/options/DataExport';

export const OptionsApp: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <header style={{ padding: '16px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
          Job Copilot Options
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
          Configure backend connection, privacy controls, and data export
        </p>
      </header>

      {/* Settings Sections */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <BharatCodeKey />
        <GeneralSettings />
        <PrivacySettings />
        <DataExport />
      </main>
    </div>
  );
};
