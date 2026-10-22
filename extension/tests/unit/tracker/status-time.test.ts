import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { handleApplicationSubmitted, updateApplicationStatus, sweepNoResponseApplications } from '../../../lib/tracker';
import { db } from '../../../lib/db';

const DAY = 24 * 60 * 60 * 1000;

async function submitted() {
  return handleApplicationSubmitted({ type: 'APPLICATION_SUBMITTED', jobId: 'j-t', url: 'https://example.com/apply', answers: {} });
}

// A status time can come from a recruiter email's sender-controlled Date header.
describe('status times are clamped to the application history', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('keeps a plausible supplied time', async () => {
    const app = await submitted();
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString();
    app.applied_at = twoDaysAgo;
    app.status_history = [{ status: 'applied', at: twoDaysAgo, source: 'user' }];
    await db.applications.put(app);
    const at = new Date(Date.now() - DAY).toISOString();
    const updated = await updateApplicationStatus(app.id, 'interview', 'gmail', at);
    expect(updated.status_history.at(-1)!.at).toBe(at);
  });

  it('clamps a future time to now', async () => {
    const app = await submitted();
    const updated = await updateApplicationStatus(app.id, 'interview', 'gmail', '2099-01-01T00:00:00Z');
    expect(new Date(updated.status_history.at(-1)!.at).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('clamps a time before the latest known event up to that event', async () => {
    const app = await submitted();
    const updated = await updateApplicationStatus(app.id, 'interview', 'gmail', '2000-01-01T00:00:00Z');
    expect(new Date(updated.status_history.at(-1)!.at).getTime()).toBeGreaterThanOrEqual(new Date(app.applied_at).getTime());
  });

  it('replaces an invalid time with now', async () => {
    const app = await submitted();
    const updated = await updateApplicationStatus(app.id, 'interview', 'gmail', 'not a date');
    expect(Number.isNaN(new Date(updated.status_history.at(-1)!.at).getTime())).toBe(false);
  });

  it('measures silence from the latest event anywhere in the history', async () => {
    const app = await submitted();
    const recent = new Date(Date.now() - DAY).toISOString();
    app.status_history = [
      { status: 'applied', at: recent, source: 'user' },
      { status: 'viewed', at: new Date(Date.now() - 40 * DAY).toISOString(), source: 'gmail' },
    ];
    await db.applications.put(app);
    expect(await sweepNoResponseApplications(new Date())).toBe(0);
  });
});
