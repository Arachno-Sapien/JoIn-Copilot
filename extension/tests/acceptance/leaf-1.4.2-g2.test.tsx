// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { computeAnalytics } from '../../lib/analytics';
import { DashboardApp } from '../../entrypoints/dashboard/App';
import { db } from '../../lib/db';
import { Application } from '../../lib/schemas/application';

describe('leaf-1.4.2:G2 Analytics computation and chart rendering', () => {
  const sampleApps: Application[] = [
    {
      schema_version: 1,
      id: 'app-1',
      job_id: 'job-1',
      job_snapshot: { title: 'Engineer', company: 'Company A', url: 'https://a.com', source: 'greenhouse' },
      applied_at: '2026-10-01T00:00:00Z',
      fit_score: 80,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'interview',
      status_history: [
        { status: 'applied', at: '2026-10-01T00:00:00Z', source: 'user' },
        { status: 'interview', at: '2026-10-05T00:00:00Z', source: 'gmail' }, // 4 days
      ],
      notes: '',
    },
    {
      schema_version: 1,
      id: 'app-2',
      job_id: 'job-2',
      job_snapshot: { title: 'Designer', company: 'Company B', url: 'https://b.com', source: 'lever' },
      applied_at: '2026-10-02T00:00:00Z',
      fit_score: 90,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'rejected',
      status_history: [
        { status: 'applied', at: '2026-10-02T00:00:00Z', source: 'user' },
        { status: 'rejected', at: '2026-10-10T00:00:00Z', source: 'gmail' }, // 8 days
      ],
      notes: '',
    },
    {
      schema_version: 1,
      id: 'app-3',
      job_id: 'job-3',
      job_snapshot: { title: 'PM', company: 'Company C', url: 'https://c.com', source: 'greenhouse' },
      applied_at: '2026-10-03T00:00:00Z',
      fit_score: 70,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [
        { status: 'applied', at: '2026-10-03T00:00:00Z', source: 'user' },
      ],
      notes: '',
    },
  ];

  beforeEach(async () => {
    await db.applications.clear();
    for (const app of sampleApps) {
      await db.applications.put(app);
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('computes response rate, days to first reply, applications over time and funnel', () => {
    const analytics = computeAnalytics(sampleApps);

    // 2 out of 3 received responses (interview or rejection)
    expect(analytics.responseRate).toBeCloseTo(66.7, 1);

    // First replies: 4 days and 8 days -> average 6 days
    expect(analytics.averageDaysToFirstReply).toBeCloseTo(6.0, 1);

    // Funnel counts
    expect(analytics.statusFunnel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'applied', count: 3 }),
        expect.objectContaining({ status: 'interview', count: 1 }),
        expect.objectContaining({ status: 'rejected', count: 1 }),
      ])
    );

    // Applications over time
    expect(analytics.applicationsOverTime.length).toBeGreaterThanOrEqual(1);
  });

  it('renders analytics metrics and charts in the dashboard', async () => {
    render(<DashboardApp />);

    await waitFor(() => {
      expect(screen.getByText(/66\.7%/)).toBeDefined();
      expect(screen.getByText(/6(\.0)? days/i)).toBeDefined();
    });

    // Check chart elements
    expect(screen.getByTestId('chart-applications-over-time')).toBeDefined();
    expect(screen.getByTestId('chart-status-funnel')).toBeDefined();
  });
});
