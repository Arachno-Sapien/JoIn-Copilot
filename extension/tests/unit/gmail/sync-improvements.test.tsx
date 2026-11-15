// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { db } from '../../../lib/db';
import { syncGmailWithMessages, syncGmail, extractBody, fetchGmailMessage } from '../../../lib/gmail';
import * as gmailAuth from '../../../lib/gmail-auth';
import { GmailSyncCard } from '../../../components/tracker/GmailSyncCard';
import { Application } from '../../../lib/schemas/application';

describe('Task G: Gmail Sync Improvements', () => {
  const sampleApp: Application = {
    schema_version: 1,
    id: 'app-sync-1',
    job_id: 'job-1',
    job_snapshot: {
      title: 'Senior Frontend Engineer',
      company: 'Acme Corp',
      url: 'https://example.com',
      source: 'greenhouse',
    },
    applied_at: '2026-10-15T10:00:00Z',
    fit_score: 90,
    missing_skills: [],
    resume_version: 'v1',
    answers: [],
    status: 'applied',
    status_history: [{ status: 'applied', at: '2026-10-15T10:00:00Z', source: 'user' }],
    notes: '',
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.applications.clear();
    await db.pendingConfirmations.clear();
    await db.processedEmails.clear();
    await db.applications.put(sampleApp);

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => {}),
        },
      },
      runtime: {
        getManifest: vi.fn(() => ({
          oauth2: { client_id: 'dummy-client-id.apps.googleusercontent.com' },
        })),
      },
    };
  });

  it('writes a low-confidence result to the pendingConfirmations table', async () => {
    const mockClassifier = vi.fn().mockResolvedValue({
      matched_application_id: 'app-sync-1',
      classification: 'interview',
      confidence: 0.55,
      reasoning: 'Interview mention with low certainty',
    });

    const result = await syncGmailWithMessages({
      messages: [
        {
          id: 'msg-low-conf-1',
          sender: 'recruiter@acme.com',
          subject: 'Interview discussion',
          date: '2026-10-20T10:00:00Z',
          body: 'Are you available to chat next week?',
        } as any,
      ],
      classifier: mockClassifier,
      threshold: 0.8,
    });

    expect(result.pendingConfirmations).toHaveLength(1);
    const stored = await db.pendingConfirmations.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].applicationId).toBe('app-sync-1');
    expect(stored[0].company).toBe('Acme Corp');
    expect(stored[0].role).toBe('Senior Frontend Engineer');
    expect(stored[0].detectedStatus).toBe('interview');
    expect(stored[0].confidence).toBe(0.55);
    expect(stored[0].messageId).toBe('msg-low-conf-1');
  });

  it('classifies the same message id only once across two sync runs', async () => {
    const mockClassifier = vi.fn().mockResolvedValue({
      matched_application_id: 'app-sync-1',
      classification: 'interview',
      confidence: 0.95,
      reasoning: 'High confidence interview invite',
    });

    const message = {
      id: 'msg-repeat-1',
      sender: 'hr@acme.com',
      subject: 'Interview invite',
      date: '2026-10-20T10:00:00Z',
      body: 'Confirmed interview time',
    } as any;

    // Run 1
    const run1 = await syncGmailWithMessages({
      messages: [message],
      classifier: mockClassifier,
    });
    expect(run1.updatedCount).toBe(1);
    expect(mockClassifier).toHaveBeenCalledTimes(1);

    // Verify it was marked in processedEmails
    const processed = await db.processedEmails.get('msg-repeat-1');
    expect(processed).toBeDefined();

    // Run 2: same message id
    const run2 = await syncGmailWithMessages({
      messages: [message],
      classifier: mockClassifier,
    });
    expect(run2.updatedCount).toBe(0);
    // Classifier must NOT be called again
    expect(mockClassifier).toHaveBeenCalledTimes(1);
  });

  it('clears cached token and retries once on 401; throws if second attempt is 401', async () => {
    let tokenCallCount = 0;
    vi.spyOn(gmailAuth, 'getGmailAuthToken').mockImplementation(async () => {
      tokenCallCount++;
      return `token-${tokenCallCount}`;
    });
    const removeTokenSpy = vi.spyOn(gmailAuth, 'removeGmailCachedAuthToken').mockResolvedValue();

    // 1. Success on retry
    let fetchCount = 0;
    globalThis.fetch = vi.fn(async (_url: any, options: any) => {
      fetchCount++;
      const auth = options?.headers?.Authorization;
      if (auth === 'Bearer token-1') {
        return { status: 401, ok: false } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ messages: [] }),
      } as Response;
    }) as any;

    const result = await syncGmail();
    expect(result.updatedCount).toBe(0);
    expect(removeTokenSpy).toHaveBeenCalledWith('token-1');
    expect(fetchCount).toBe(2);

    // 2. Second 401 throws
    tokenCallCount = 0;
    globalThis.fetch = vi.fn(async () => {
      return { status: 401, ok: false } as Response;
    }) as any;

    await expect(syncGmail()).rejects.toThrow(/401/);
  });

  it('extracts HTML-only email text without tags before sending to classifier', async () => {
    function toBase64Url(str: string): string {
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const htmlContent = '<div><p>Thank you for applying to <strong>Acme Corp</strong>!</p><p>We received your application.</p></div>';
    const payload = {
      mimeType: 'text/html',
      body: {
        data: toBase64Url(htmlContent),
      },
    };

    const text = extractBody(payload);
    expect(text).not.toContain('<p>');
    expect(text).not.toContain('<strong>');
    expect(text).not.toContain('<div>');
    expect(text).toContain('Thank you for applying to Acme Corp!');
    expect(text).toContain('We received your application.');

    // Test with fetchGmailMessage mock
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        payload: {
          headers: [
            { name: 'From', value: 'jobs@acme.com' },
            { name: 'Subject', value: 'Application Status' },
            { name: 'Date', value: '2026-10-21T12:00:00Z' },
          ],
          mimeType: 'text/html',
          body: {
            data: toBase64Url('<p>Your interview is scheduled.</p>'),
          },
        },
      }),
    })) as any;

    const fetched = await fetchGmailMessage('valid-token', 'msg-html-1');
    expect(fetched.id).toBe('msg-html-1');
    expect(fetched.body).toBe('Your interview is scheduled.');
    expect(fetched.body).not.toContain('<p>');
  });

  it('shows explanation instead of button when manifest has dummy client ID', async () => {
    (globalThis as any).chrome.runtime.getManifest = vi.fn(() => ({
      oauth2: { client_id: 'dummy-client-id.apps.googleusercontent.com' },
    }));

    render(<GmailSyncCard />);

    expect(
      screen.getByText(/Gmail sync requires setting up a Google OAuth client ID in docs\/guide\/setup\.md\./i)
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /Connect Gmail/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sync now/i })).toBeNull();
  });

  it('shows Connect Gmail button when client ID is configured and user is not signed in', async () => {
    (globalThis as any).chrome.runtime.getManifest = vi.fn(() => ({
      oauth2: { client_id: '123456789.apps.googleusercontent.com' },
    }));
    vi.spyOn(gmailAuth, 'getGmailAuthToken').mockRejectedValue(new Error('User not signed in'));

    render(<GmailSyncCard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect Gmail/i })).toBeDefined();
    });
  });
});
