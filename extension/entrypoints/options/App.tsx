import React from 'react';
import { AiProvider } from '../../components/options/AiProvider';
import { GeneralSettings } from '../../components/options/GeneralSettings';
import { PrivacySettings } from '../../components/options/PrivacySettings';
import { DataExport } from '../../components/options/DataExport';
import { page, h1, subtitle, color, space, stack } from '../../components/ui';

export const OptionsApp: React.FC = () => {
  return (
    <div style={{ ...page, minHeight: '100vh' }}>
      {/* Top Header */}
      <header style={{ padding: '16px 24px', backgroundColor: color.surface, borderBottom: `1px solid ${color.border}` }}>
        <h1 style={h1}>
          Job Copilot Options
        </h1>
        <p style={subtitle}>
          Configure the AI provider, backend connection, privacy controls, and data export
        </p>
      </header>

      {/* Settings Sections */}
      <main style={{ ...stack, maxWidth: '800px', margin: '0 auto', padding: space.xl, gap: space.xl }}>
        <AiProvider />
        <GeneralSettings />
        <PrivacySettings />
        <DataExport />
      </main>
    </div>
  );
};
