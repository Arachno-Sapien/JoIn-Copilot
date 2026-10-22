// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../lib/db';
import { handleEmailClassificationResult, syncGmailWithMessages } from '../../lib/gmail';
import { Application } from '../../lib/schemas/application';

describe('leaf-1.4.1:G5 No email body text stored in IndexedDB or chrome.storage', () => {
  beforeEach(async () => {
    await db.applications.clear();
    await db.profile.clear();
    await db.resumes.clear();

    const app: Application = {
      schema_version: 1,
      id: 'app-sync-1',
      job_id: 'job-sync-1',
      job_snapshot: { title: 'Backend Engineer', company: 'Acme', url: 'https://example.com', source: 'greenhouse' },
      applied_at: '2026-10-10T10:00:00Z',
      fit_score: 85,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [{ status: 'applied', at: '2026-10-10T10:00:00Z', source: 'user' }],
      notes: '',
    };
    await db.applications.put(app);
  });

  it('never stores email body text in IndexedDB or chrome.storage after processing sync', async () => {
    const canaryBody = 'CANARY_GMAIL_BODY_SECRET_67890_NEVER_PERSIST_TO_DISK_OR_DB';

    const mockMessages = [
      {
        id: 'msg-1',
        sender: 'recruiter@acme.com',
        subject: 'Acme Interview Invitation',
        date: '2026-10-18T16:00:00Z',
        body: canaryBody,
      },
    ];

    // Mock classify function
    const mockClassify = async () => ({
      matched_application_id: 'app-sync-1',
      classification: 'interview' as const,
      confidence: 0.95,
      reasoning: 'Interview scheduled',
    });

    await syncGmailWithMessages({
      messages: mockMessages,
      classifier: mockClassify,
      threshold: 0.8,
    });

    // Check application updated
    const app = await db.applications.get('app-sync-1');
    expect(app?.status).toBe('interview');

    // Dump all IndexedDB tables
    const allApps = await db.applications.toArray();
    const allProfile = await db.profile.toArray();
    const allResumes = await db.resumes.toArray();

    const dbDump = JSON.stringify({ allApps, allProfile, allResumes });
    expect(dbDump).not.toContain(canaryBody);

    // Check chrome.storage if available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storageDump = JSON.stringify(await chrome.storage.local.get(null));
      expect(storageDump).not.toContain(canaryBody);
    }

    // Verify label and date are stored
    expect(dbDump).toContain('interview');
    expect(dbDump).toContain('2026-10-18');
  });
});
