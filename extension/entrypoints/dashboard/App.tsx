import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { Application } from '../../lib/schemas/application';
import { computeAnalytics } from '../../lib/analytics';
import { AnalyticsView } from '../../components/dashboard/AnalyticsView';
import { TrackerTable } from '../../components/tracker/TrackerTable';

export const DashboardApp: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.applications.toArray().then((apps) => {
      setApplications(apps);
      setLoading(false);
    });
  }, []);

  const analytics = computeAnalytics(applications);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <header style={{ padding: '16px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
            Job Copilot Dashboard
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
            Application pipeline analytics, metrics, and tracking
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Analytics Section */}
        <section>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>
            Pipeline Analytics
          </h2>
          <AnalyticsView analytics={analytics} />
        </section>

        {/* Tracker Table Section */}
        <section style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>
            All Applications ({applications.length})
          </h2>
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading applications...</div>
          ) : (
            <TrackerTable applications={applications} />
          )}
        </section>
      </main>
    </div>
  );
};
