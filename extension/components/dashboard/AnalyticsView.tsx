import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { AnalyticsResult } from '../../lib/analytics';

interface AnalyticsViewProps {
  analytics: AnalyticsResult;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total Applications</div>
          <div data-testid="metric-total-apps" style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {analytics.totalApplications}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Response Rate</div>
          <div data-testid="metric-response-rate" style={{ fontSize: '24px', fontWeight: 700, color: '#4f46e5', marginTop: '4px' }}>
            {analytics.responseRate.toFixed(1)}%
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Avg Days to Reply</div>
          <div data-testid="metric-avg-days" style={{ fontSize: '24px', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
            {analytics.averageDaysToFirstReply.toFixed(1)} days
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Applications Over Time Chart */}
        <div
          data-testid="chart-applications-over-time"
          style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            Applications Over Time
          </h3>
          <div style={{ width: '100%', height: 220 }}>
            <LineChart width={420} height={200} data={analytics.applicationsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
              <YAxis allowDecimals={false} stroke="#9ca3af" fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </div>
        </div>

        {/* Status Funnel Chart */}
        <div
          data-testid="chart-status-funnel"
          style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            Status Funnel
          </h3>
          <div style={{ width: '100%', height: 220 }}>
            <BarChart width={420} height={200} data={analytics.statusFunnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="status" stroke="#9ca3af" fontSize={11} />
              <YAxis allowDecimals={false} stroke="#9ca3af" fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </div>
        </div>
      </div>
    </div>
  );
};
