// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { db } from '../../lib/db';
import { handleEmailClassificationResult } from '../../lib/gmail';
import { EmailConfirmations } from '../../components/sidepanel/EmailConfirmations';
import { Application } from '../../lib/schemas/application';

describe('leaf-1.4.1:G4 Email Classification Confidence Threshold and Confirmation', () => {
  beforeEach(async () => {
    await db.applications.clear();
    const app: Application = {
      schema_version: 1,
      id: 'app-stripe-1',
      job_id: 'job-1',
      job_snapshot: { title: 'Software Engineer', company: 'Stripe', url: 'https://example.com', source: 'greenhouse' },
      applied_at: '2026-10-10T10:00:00Z',
      fit_score: 90,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [{ status: 'applied', at: '2026-10-10T10:00:00Z', source: 'user' }],
      notes: '',
    };
    await db.applications.put(app);
  });

  afterEach(() => {
    cleanup();
  });

  it('automatically updates status with source gmail when confidence >= threshold', async () => {
    const classification = {
      matched_application_id: 'app-stripe-1',
      classification: 'interview' as const,
      confidence: 0.92,
      reasoning: 'Interview invite email from Stripe',
    };

    const pending = await handleEmailClassificationResult({
      classification,
      email: {
        sender: 'recruiter@stripe.com',
        subject: 'Interview with Stripe',
        date: '2026-10-18T12:00:00Z',
        body: 'Canary body text',
      },
      threshold: 0.8,
    });

    // Should not return a pending confirmation
    expect(pending).toBeNull();

    // Application status should be updated directly in DB
    const updated = await db.applications.get('app-stripe-1');
    expect(updated?.status).toBe('interview');
    const lastHistory = updated?.status_history[updated.status_history.length - 1];
    expect(lastHistory?.status).toBe('interview');
    expect(lastHistory?.source).toBe('gmail');
  });

  it('shows confirmation when confidence < threshold and only updates upon user confirmation', async () => {
    const classification = {
      matched_application_id: 'app-stripe-1',
      classification: 'rejection' as const,
      confidence: 0.65,
      reasoning: 'Likely rejection email',
    };

    const pending = await handleEmailClassificationResult({
      classification,
      email: {
        sender: 'no-reply@stripe.com',
        subject: 'Update on Stripe Application',
        date: '2026-10-18T14:00:00Z',
        body: 'Canary body text',
      },
      threshold: 0.8,
    });

    expect(pending).not.toBeNull();
    expect(pending?.detectedStatus).toBe('rejection');

    // DB application status must still be 'applied' (untouched)
    let currentApp = await db.applications.get('app-stripe-1');
    expect(currentApp?.status).toBe('applied');

    // Render confirmation UI
    const onConfirmMock = async () => {
      await db.applications.update('app-stripe-1', {
        status: pending!.detectedStatus,
        status_history: [
          ...currentApp!.status_history,
          { status: pending!.detectedStatus, at: new Date().toISOString(), source: 'gmail' },
        ],
      });
    };

    render(
      <EmailConfirmations
        confirmations={[pending!]}
        onConfirm={onConfirmMock}
        onDismiss={() => {}}
      />
    );

    expect(screen.getAllByText(/Stripe/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/rejection/i)).toBeDefined();

    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);

    await waitFor(async () => {
      const confirmedApp = await db.applications.get('app-stripe-1');
      expect(confirmedApp?.status).toBe('rejection');
      const last = confirmedApp?.status_history[confirmedApp.status_history.length - 1];
      expect(last?.source).toBe('gmail');
    });
  });
});
