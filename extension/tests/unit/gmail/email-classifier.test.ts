import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../../lib/db';
import { handleEmailClassificationResult } from '../../../lib/gmail';
import { Application } from '../../../lib/schemas/application';

describe('Email Classifier Unit Tests', () => {
  beforeEach(async () => {
    await db.applications.clear();
    const app: Application = {
      schema_version: 1,
      id: 'app-unit-1',
      job_id: 'job-1',
      job_snapshot: { title: 'Frontend Engineer', company: 'Figma', url: 'https://example.com', source: 'greenhouse' },
      applied_at: '2026-10-10T10:00:00Z',
      fit_score: 92,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [{ status: 'applied', at: '2026-10-10T10:00:00Z', source: 'user' }],
      notes: '',
    };
    await db.applications.put(app);
  });

  it('updates status directly when confidence exceeds threshold', async () => {
    const pending = await handleEmailClassificationResult({
      classification: {
        matched_application_id: 'app-unit-1',
        classification: 'offer',
        confidence: 0.98,
        reasoning: 'Offer confirmed',
      },
      email: {
        sender: 'jobs@figma.com',
        subject: 'Offer Letter',
        date: '2026-10-18T12:00:00Z',
        body: 'Details inside',
      },
      threshold: 0.8,
    });

    expect(pending).toBeNull();
    const app = await db.applications.get('app-unit-1');
    expect(app?.status).toBe('offer');
    expect(app?.status_history[app.status_history.length - 1].source).toBe('gmail');
  });

  it('returns pending confirmation when confidence is below threshold', async () => {
    const pending = await handleEmailClassificationResult({
      classification: {
        matched_application_id: 'app-unit-1',
        classification: 'assessment',
        confidence: 0.65,
        reasoning: 'May be an assessment invitation',
      },
      email: {
        sender: 'test@figma.com',
        subject: 'Coding Challenge',
        date: '2026-10-18T13:00:00Z',
        body: 'Link to test',
      },
      threshold: 0.8,
    });

    expect(pending).not.toBeNull();
    expect(pending?.detectedStatus).toBe('assessment');
    expect(pending?.company).toBe('Figma');

    // Application status remains unchanged
    const app = await db.applications.get('app-unit-1');
    expect(app?.status).toBe('applied');
  });
});
