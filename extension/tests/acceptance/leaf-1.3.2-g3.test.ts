import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sweepNoResponseApplications, handleTrackerAlarm } from '../../lib/tracker';
import { db } from '../../lib/db';
import { Application } from '../../lib/schemas/application';

describe('leaf-1.3.2:G3 28-day no_response Sweep', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('marks an application with no update for 28 days as no_response with source auto exactly once', async () => {
    const now = new Date('2026-03-01T12:00:00Z');
    const dayMs = 24 * 60 * 60 * 1000;

    // App 1: applied 30 days ago, no subsequent updates -> SHOULD be marked no_response
    const app1: Application = {
      schema_version: 1,
      id: 'app-stale',
      job_id: 'job-1',
      job_snapshot: { title: 'Engineer', company: 'Corp1', url: 'https://boards.greenhouse.io/1', source: 'greenhouse' },
      applied_at: new Date(now.getTime() - 30 * dayMs).toISOString(),
      fit_score: 80,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [
        { status: 'applied', at: new Date(now.getTime() - 30 * dayMs).toISOString(), source: 'user' },
      ],
      notes: '',
    };

    // App 2: applied 10 days ago -> SHOULD NOT be marked
    const app2: Application = {
      schema_version: 1,
      id: 'app-fresh',
      job_id: 'job-2',
      job_snapshot: { title: 'Designer', company: 'Corp2', url: 'https://jobs.lever.co/2', source: 'lever' },
      applied_at: new Date(now.getTime() - 10 * dayMs).toISOString(),
      fit_score: 90,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [
        { status: 'applied', at: new Date(now.getTime() - 10 * dayMs).toISOString(), source: 'user' },
      ],
      notes: '',
    };

    // App 3: applied 40 days ago, but updated to 'interview' 5 days ago -> SHOULD NOT be marked
    const app3: Application = {
      schema_version: 1,
      id: 'app-active-interview',
      job_id: 'job-3',
      job_snapshot: { title: 'PM', company: 'Corp3', url: 'https://boards.greenhouse.io/3', source: 'greenhouse' },
      applied_at: new Date(now.getTime() - 40 * dayMs).toISOString(),
      fit_score: 85,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'interview',
      status_history: [
        { status: 'applied', at: new Date(now.getTime() - 40 * dayMs).toISOString(), source: 'user' },
        { status: 'interview', at: new Date(now.getTime() - 5 * dayMs).toISOString(), source: 'gmail' },
      ],
      notes: '',
    };

    // App 4: applied 60 days ago, was already marked no_response 20 days ago -> SHOULD NOT be marked again
    const app4: Application = {
      schema_version: 1,
      id: 'app-already-no-response',
      job_id: 'job-4',
      job_snapshot: { title: 'Analyst', company: 'Corp4', url: 'https://jobs.lever.co/4', source: 'lever' },
      applied_at: new Date(now.getTime() - 60 * dayMs).toISOString(),
      fit_score: 70,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'no_response',
      status_history: [
        { status: 'applied', at: new Date(now.getTime() - 60 * dayMs).toISOString(), source: 'user' },
        { status: 'no_response', at: new Date(now.getTime() - 20 * dayMs).toISOString(), source: 'auto' },
      ],
      notes: '',
    };

    await db.applications.bulkPut([app1, app2, app3, app4]);

    // Trigger sweep via alarm handler
    const sweptCount = await handleTrackerAlarm({ name: 'no_response_sweep' }, now);
    expect(sweptCount).toBe(1);

    // Verify App 1 is updated to no_response with source auto
    const updated1 = await db.applications.get('app-stale');
    expect(updated1?.status).toBe('no_response');
    expect(updated1?.status_history.length).toBe(2);
    expect(updated1?.status_history[1].status).toBe('no_response');
    expect(updated1?.status_history[1].source).toBe('auto');

    // Verify App 2 is unchanged
    const updated2 = await db.applications.get('app-fresh');
    expect(updated2?.status).toBe('applied');

    // Verify App 3 is unchanged
    const updated3 = await db.applications.get('app-active-interview');
    expect(updated3?.status).toBe('interview');

    // Verify App 4 was not updated again (status_history remains length 2)
    const updated4 = await db.applications.get('app-already-no-response');
    expect(updated4?.status_history.length).toBe(2);

    // Running sweep a second time changes 0 applications (exactly once guarantee)
    const secondSweep = await sweepNoResponseApplications(now);
    expect(secondSweep).toBe(0);
  });
});
