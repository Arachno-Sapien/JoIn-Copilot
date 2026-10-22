// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { db } from '../../lib/db';
import { syncGmailWithMessages } from '../../lib/gmail';
import { Application } from '../../lib/schemas/application';
import { DashboardApp } from '../../entrypoints/dashboard/App';

describe('node-1.4:N2 Mocked Gmail Sync Updates Application and Dashboard Shows History', () => {
  beforeEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await db.applications.clear();
  });

  afterEach(async () => {
    cleanup();
    await db.applications.clear();
  });

  it('updates application status from mocked Gmail sync and renders updated status and history', async () => {
    // 1. Initial application in db with 'applied' status
    const initialApp: Application = {
      schema_version: 1,
      id: 'app-sync-101',
      job_id: 'job-sync-101',
      job_snapshot: {
        title: 'Senior Frontend Engineer',
        company: 'Stripe',
        url: 'https://stripe.com/jobs/1',
        source: 'greenhouse',
      },
      applied_at: '2026-10-15T10:00:00Z',
      fit_score: 85,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [
        { status: 'applied', at: '2026-10-15T10:00:00Z', source: 'user' },
      ],
      notes: '',
    };
    await db.applications.put(initialApp);

    // 2. Mock incoming Gmail message
    const incomingMessage = {
      sender: 'recruiting@stripe.com',
      subject: 'Interviewing with Stripe: Next Steps',
      date: '2026-10-18T14:00:00Z',
      body: 'Hi Alex, we would like to invite you for a technical interview next Tuesday.',
    };

    // Mock classifier returning high-confidence interview classification matching initialApp
    const mockClassifier = vi.fn().mockResolvedValue({
      matched_application_id: 'app-sync-101',
      classification: 'interview',
      confidence: 0.95,
      reasoning: 'Direct interview invitation from Stripe recruiting.',
    });

    const syncResult = await syncGmailWithMessages({
      messages: [incomingMessage],
      classifier: mockClassifier,
      threshold: 0.8,
    });

    expect(syncResult.updatedCount).toBe(1);

    // Verify database state has updated status and appended history entry
    const updatedApp = await db.applications.get('app-sync-101');
    expect(updatedApp?.status).toBe('interview');
    expect(updatedApp?.status_history.length).toBe(2);
    expect(updatedApp?.status_history[1].status).toBe('interview');
    expect(updatedApp?.status_history[1].source).toBe('gmail');

    // 3. Render DashboardApp and verify UI displays the new status and updated metrics
    render(<DashboardApp />);

    await waitFor(() => {
      // Total applications
      expect(screen.getByTestId('metric-total-apps').textContent).toBe('1');
      // Status badge reflects 'interview'
      expect(screen.getByText('Stripe')).toBeDefined();
      const statusBadges = screen.getAllByText(/interview/i);
      expect(statusBadges.length).toBeGreaterThan(0);
    });
  });
});
