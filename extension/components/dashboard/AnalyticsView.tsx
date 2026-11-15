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
import * as ui from '../ui';

const metricLabel: React.CSSProperties = { fontSize: ui.font.sm, fontWeight: 600, color: ui.color.textSubtle, textTransform: 'uppercase' };
const metricValue: React.CSSProperties = { fontSize: '24px', fontWeight: 700, marginTop: ui.space.xs };

interface AnalyticsViewProps {
  analytics: AnalyticsResult;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xl }}>
      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: ui.space.lg }}>
        <div style={ui.card}>
          <div style={metricLabel}>Total Applications</div>
          <div data-testid="metric-total-apps" style={{ ...metricValue, color: ui.color.text }}>
            {analytics.totalApplications}
          </div>
        </div>

        <div style={ui.card}>
          <div style={metricLabel}>Response Rate</div>
          <div data-testid="metric-response-rate" style={{ ...metricValue, color: ui.color.primary }}>
            {analytics.responseRate.toFixed(1)}%
          </div>
        </div>

        <div style={ui.card}>
          <div style={metricLabel}>Avg Days to Reply</div>
          <div data-testid="metric-avg-days" style={{ ...metricValue, color: ui.color.success }}>
            {analytics.averageDaysToFirstReply.toFixed(1)} days
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: ui.space.xl }}>
        {/* Applications Over Time Chart */}
        <div
          data-testid="chart-applications-over-time"
          style={ui.card}
        >
          <h3 style={ui.h4}>
            Applications Over Time
          </h3>
          <div style={{ width: '100%', height: 220, overflowX: 'auto' }}>
            <LineChart width={420} height={200} data={analytics.applicationsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke={ui.color.border} />
              <XAxis dataKey="date" stroke={ui.color.textSubtle} fontSize={11} />
              <YAxis allowDecimals={false} stroke={ui.color.textSubtle} fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={ui.color.primary} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </div>
        </div>

        {/* Status Funnel Chart */}
        <div
          data-testid="chart-status-funnel"
          style={ui.card}
        >
          <h3 style={ui.h4}>
            Status Funnel
          </h3>
          <div style={{ width: '100%', height: 220, overflowX: 'auto' }}>
            <BarChart width={420} height={200} data={analytics.statusFunnel}>
              <CartesianGrid strokeDasharray="3 3" stroke={ui.color.border} />
              <XAxis dataKey="status" stroke={ui.color.textSubtle} fontSize={11} />
              <YAxis allowDecimals={false} stroke={ui.color.textSubtle} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill={ui.color.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </div>
        </div>
      </div>
    </div>
  );
};
