import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { Application } from '../../lib/schemas/application';
import { computeAnalytics } from '../../lib/analytics';
import { AnalyticsView } from '../../components/dashboard/AnalyticsView';
import { TrackerTable } from '../../components/tracker/TrackerTable';
import { page, h1, h2, subtitle, color, space, stack, card, statusText } from '../../components/ui';

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
    <div style={{ ...page, minHeight: '100vh' }}>
      {/* Top Header */}
      <header style={{ padding: '16px 24px', backgroundColor: color.surface, borderBottom: `1px solid ${color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={h1}>
            Job Copilot Dashboard
          </h1>
          <p style={subtitle}>
            Application pipeline analytics, metrics, and tracking
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ ...stack, maxWidth: '1200px', margin: '0 auto', padding: space.xl, gap: space.xl }}>
        {/* Analytics Section */}
        <section>
          <h2 style={h2}>
            Pipeline Analytics
          </h2>
          <AnalyticsView analytics={analytics} />
        </section>

        {/* Tracker Table Section */}
        <section style={card}>
          <h2 style={h2}>
            All Applications ({applications.length})
          </h2>
          {loading ? (
            <div style={statusText}>Loading applications...</div>
          ) : (
            <TrackerTable applications={applications} />
          )}
        </section>
      </main>
    </div>
  );
};
