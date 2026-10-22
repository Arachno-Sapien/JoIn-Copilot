import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { handleApplicationSubmitted } from '../../lib/tracker';
import { db } from '../../lib/db';
import { ApplicationSubmittedMessage } from '../../lib/messaging';

describe('leaf-1.3.2:G1 Application Creation on Submission', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('creates one Application with job_snapshot, applied_at, fit_score, missing_skills, answers and status applied', async () => {
    const msg: ApplicationSubmittedMessage = {
      type: 'APPLICATION_SUBMITTED',
      jobId: 'job-greenhouse-42',
      url: 'https://boards.greenhouse.io/acme/jobs/42',
      answers: {
        first_name: 'Alex',
        email: 'alex@example.com',
        comments: 'Excited about the role.',
      },
    };

    const extra = {
      job: {
        id: 'job-greenhouse-42',
        title: 'Backend Engineer',
        company: 'Acme Corp',
        url: 'https://boards.greenhouse.io/acme/jobs/42',
        source: 'greenhouse',
      },
      fit_score: 85,
      missing_skills: ['Kubernetes'],
      resume_version: 'resume-v1',
    };

    const app = await handleApplicationSubmitted(msg, extra);

    expect(app.id).toBeDefined();
    expect(app.job_id).toBe('job-greenhouse-42');
    expect(app.status).toBe('applied');
    expect(app.fit_score).toBe(85);
    expect(app.missing_skills).toEqual(['Kubernetes']);
    expect(app.resume_version).toBe('resume-v1');
    expect(app.applied_at).toBeDefined();
    expect(new Date(app.applied_at).getTime()).toBeGreaterThan(0);

    // job_snapshot
    expect(app.job_snapshot.title).toBe('Backend Engineer');
    expect(app.job_snapshot.company).toBe('Acme Corp');
    expect(app.job_snapshot.url).toBe('https://boards.greenhouse.io/acme/jobs/42');
    expect(app.job_snapshot.source).toBe('greenhouse');

    // answers
    expect(app.answers.length).toBeGreaterThanOrEqual(3);
    const firstNameAns = app.answers.find((a) => a.question === 'first_name');
    expect(firstNameAns?.answer).toBe('Alex');

    // status_history initial entry
    expect(app.status_history.length).toBe(1);
    expect(app.status_history[0].status).toBe('applied');
    expect(app.status_history[0].source).toBe('user');

    // Saved to Dexie database
    const stored = await db.applications.get(app.id);
    expect(stored).toBeDefined();
    expect(stored?.id).toBe(app.id);
  });
});
