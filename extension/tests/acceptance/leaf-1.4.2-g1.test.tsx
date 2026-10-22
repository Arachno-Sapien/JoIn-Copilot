// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { db } from '../../lib/db';
import { DashboardApp } from '../../entrypoints/dashboard/App';
import { Application } from '../../lib/schemas/application';

describe('leaf-1.4.2:G1 Dashboard renders tracker table from IndexedDB', () => {
  beforeEach(async () => {
    await db.applications.clear();
    const apps: Application[] = [
      {
        schema_version: 1,
        id: 'app-dash-1',
        job_id: 'job-1',
        job_snapshot: { title: 'Staff Engineer', company: 'Acme Systems', url: 'https://example.com', source: 'greenhouse' },
        applied_at: '2026-10-01T10:00:00Z',
        fit_score: 88,
        missing_skills: [],
        resume_version: 'v1',
        answers: [],
        status: 'applied',
        status_history: [{ status: 'applied', at: '2026-10-01T10:00:00Z', source: 'user' }],
        notes: '',
      },
      {
        schema_version: 1,
        id: 'app-dash-2',
        job_id: 'job-2',
        job_snapshot: { title: 'Fullstack Dev', company: 'Stripe Payments', url: 'https://example.com/2', source: 'lever' },
        applied_at: '2026-10-05T12:00:00Z',
        fit_score: 95,
        missing_skills: [],
        resume_version: 'v1',
        answers: [],
        status: 'interview',
        status_history: [{ status: 'applied', at: '2026-10-05T12:00:00Z', source: 'user' }],
        notes: '',
      },
    ];
    for (const app of apps) {
      await db.applications.put(app);
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tracker table populated with applications from IndexedDB', async () => {
    render(<DashboardApp />);

    await waitFor(() => {
      expect(screen.getByText('Acme Systems')).toBeDefined();
      expect(screen.getByText('Stripe Payments')).toBeDefined();
    });
  });
});
