import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { updateApplicationStatus } from '../../lib/tracker';
import { db } from '../../lib/db';
import { Application } from '../../lib/schemas/application';

describe('leaf-1.3.2:G2 Status History and Validation', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('appends to status_history with timestamp and source on valid status update', async () => {
    const initialApp: Application = {
      schema_version: 1,
      id: 'app-test-1',
      job_id: 'job-1',
      job_snapshot: {
        title: 'Frontend Engineer',
        company: 'Stripe',
        url: 'https://boards.greenhouse.io/stripe/jobs/1',
        source: 'greenhouse',
      },
      applied_at: new Date('2026-01-01T10:00:00Z').toISOString(),
      fit_score: 90,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [
        { status: 'applied', at: '2026-01-01T10:00:00Z', source: 'user' },
      ],
      notes: '',
    };
    await db.applications.put(initialApp);

    // Update status to 'interview' via 'gmail'
    const updated = await updateApplicationStatus('app-test-1', 'interview', 'gmail');
    expect(updated.status).toBe('interview');
    expect(updated.status_history.length).toBe(2);
    expect(updated.status_history[1].status).toBe('interview');
    expect(updated.status_history[1].source).toBe('gmail');
    expect(new Date(updated.status_history[1].at).getTime()).toBeGreaterThan(0);

    // Update status to 'offer' via 'user'
    const finalApp = await updateApplicationStatus('app-test-1', 'offer', 'user');
    expect(finalApp.status).toBe('offer');
    expect(finalApp.status_history.length).toBe(3);
    expect(finalApp.status_history[2].status).toBe('offer');
    expect(finalApp.status_history[2].source).toBe('user');
  });

  it('rejects an unknown status', async () => {
    const initialApp: Application = {
      schema_version: 1,
      id: 'app-test-2',
      job_id: 'job-2',
      job_snapshot: {
        title: 'DevOps Engineer',
        company: 'Netflix',
        url: 'https://jobs.lever.co/netflix/2',
        source: 'lever',
      },
      applied_at: new Date().toISOString(),
      fit_score: 75,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [{ status: 'applied', at: new Date().toISOString(), source: 'user' }],
      notes: '',
    };
    await db.applications.put(initialApp);

    await expect(updateApplicationStatus('app-test-2', 'hired' as any, 'user')).rejects.toThrow();
    await expect(updateApplicationStatus('app-test-2', 'pending' as any, 'user')).rejects.toThrow();

    // Verify application status remained unchanged
    const stored = await db.applications.get('app-test-2');
    expect(stored?.status).toBe('applied');
    expect(stored?.status_history.length).toBe(1);
  });
});
