import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { handleApplicationSubmitted, updateApplicationStatus, sweepNoResponseApplications } from '../../../lib/tracker';
import { db } from '../../../lib/db';

describe('Tracker Unit Tests', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('stores and retrieves applications in database', async () => {
    const app = await handleApplicationSubmitted({
      type: 'APPLICATION_SUBMITTED',
      jobId: 'j-1',
      url: 'https://example.com/apply',
      answers: { name: 'Jane' },
    });

    const retrieved = await db.applications.get(app.id);
    expect(retrieved?.id).toBe(app.id);
    expect(retrieved?.status).toBe('applied');
  });

  it('updates status and records history', async () => {
    const app = await handleApplicationSubmitted({
      type: 'APPLICATION_SUBMITTED',
      jobId: 'j-2',
      url: 'https://example.com/apply',
      answers: {},
    });

    const updated = await updateApplicationStatus(app.id, 'viewed', 'portal');
    expect(updated.status).toBe('viewed');
    expect(updated.status_history.length).toBe(2);
    expect(updated.status_history[1].source).toBe('portal');
  });
});
