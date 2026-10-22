import { describe, it, expect } from 'vitest';
import { computeAnalytics } from '../../../lib/analytics';
import { Application } from '../../../lib/schemas/application';

describe('Analytics Unit Tests', () => {
  it('handles empty applications array gracefully', () => {
    const res = computeAnalytics([]);
    expect(res.totalApplications).toBe(0);
    expect(res.responseRate).toBe(0);
    expect(res.averageDaysToFirstReply).toBe(0);
    expect(res.applicationsOverTime).toEqual([]);
    expect(res.statusFunnel.length).toBe(5);
  });

  it('correctly calculates response rate and average days to reply', () => {
    const apps: Application[] = [
      {
        schema_version: 1,
        id: '1',
        job_id: 'j1',
        job_snapshot: { title: 'Engineer', company: 'A', url: '', source: 'greenhouse' },
        applied_at: '2026-10-01T00:00:00Z',
        fit_score: 90,
        missing_skills: [],
        resume_version: 'v1',
        answers: [],
        status: 'interview',
        status_history: [
          { status: 'applied', at: '2026-10-01T00:00:00Z', source: 'user' },
          { status: 'interview', at: '2026-10-03T00:00:00Z', source: 'gmail' }, // 2 days
        ],
        notes: '',
      },
      {
        schema_version: 1,
        id: '2',
        job_id: 'j2',
        job_snapshot: { title: 'Designer', company: 'B', url: '', source: 'lever' },
        applied_at: '2026-10-01T00:00:00Z',
        fit_score: 80,
        missing_skills: [],
        resume_version: 'v1',
        answers: [],
        status: 'applied',
        status_history: [{ status: 'applied', at: '2026-10-01T00:00:00Z', source: 'user' }],
        notes: '',
      },
    ];

    const res = computeAnalytics(apps);
    expect(res.totalApplications).toBe(2);
    expect(res.responseRate).toBe(50);
    expect(res.averageDaysToFirstReply).toBe(2);
  });
});
