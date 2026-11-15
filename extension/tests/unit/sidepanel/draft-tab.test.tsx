// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { DraftPage } from '../../../components/sidepanel/DraftPage';
import * as draftApi from '../../../lib/api/draft';
import { ApiError } from '../../../lib/api/client';
import { Profile } from '../../../lib/schemas/profile';
import { Job } from '../../../lib/schemas/job';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleProfile: Profile = {
  schema_version: 1,
  name: 'Dev Candidate',
  email: 'dev@example.com',
  phone: '555-1234',
  location: 'Remote',
  education: [],
  experience: [],
  projects: [],
  skills: [{ name: 'TypeScript', level: 'strong' }],
  certifications: [],
  preferences: { locations: [], remote: 'remote' },
};

const sampleJob: Job = {
  id: 'job-1',
  source: 'manual',
  source_id: '1',
  url: 'https://example.com/job/1',
  title: 'Senior Frontend Engineer',
  company: 'WebTech',
  location: 'Remote',
  remote: 'remote',
  job_type: 'full-time',
  required_skills: ['TypeScript'],
  nice_to_have_skills: [],
  experience_years_min: 3,
  description: 'Frontend role',
  fetched_at: '2026-10-18T10:00:00Z',
};

describe('DraftPage', () => {
  it('prompts to add profile when profile is null', () => {
    render(<DraftPage profile={null} job={sampleJob} />);
    expect(screen.getByText('Add your profile on the Profile tab first.')).toBeDefined();
  });

  it('prompts to select job when job is null', () => {
    render(<DraftPage profile={sampleProfile} job={null} />);
    expect(screen.getByText('Select a job on the Jobs tab first.')).toBeDefined();
  });

  it('empty question makes no request', () => {
    const draftSpy = vi.spyOn(draftApi, 'draftAnswer');
    render(<DraftPage profile={sampleProfile} job={sampleJob} />);

    const draftBtn = screen.getByRole('button', { name: 'Draft answer' });
    expect((draftBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(draftBtn);
    expect(draftSpy).not.toHaveBeenCalled();
  });

  it('clicking Draft answer posts the job, question, and profile, and the draft text appears', async () => {
    const draftSpy = vi.spyOn(draftApi, 'draftAnswer').mockResolvedValue({
      draft: 'I am deeply excited to build accessible interfaces at WebTech.',
      claims: [
        {
          claim: 'I have 5 years experience',
          verdict: 'supported',
          judgment: 'supported',
          reason: 'Verified in profile',
        },
      ],
      flagged_spans: [],
      rewrite: null,
      rewritten_draft: null,
    });

    render(<DraftPage profile={sampleProfile} job={sampleJob} />);

    const textarea = screen.getByLabelText('Question');
    fireEvent.change(textarea, { target: { value: 'Why do you want to join?' } });

    const draftBtn = screen.getByRole('button', { name: 'Draft answer' });
    expect((draftBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(draftSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          job: sampleJob,
          question: 'Why do you want to join?',
          profile: sampleProfile,
        })
      );
      expect(screen.getByText('I am deeply excited to build accessible interfaces at WebTech.')).toBeDefined();
    });
  });

  it('a second draft replaces the first', async () => {
    const draftSpy = vi.spyOn(draftApi, 'draftAnswer')
      .mockResolvedValueOnce({
        draft: 'First draft answer text.',
        claims: [],
        flagged_spans: [],
        rewrite: null,
      })
      .mockResolvedValueOnce({
        draft: 'Second draft completely replacing the previous one.',
        claims: [],
        flagged_spans: [],
        rewrite: null,
      });

    render(<DraftPage profile={sampleProfile} job={sampleJob} />);

    const textarea = screen.getByLabelText('Question');
    const draftBtn = screen.getByRole('button', { name: 'Draft answer' });

    // First draft
    fireEvent.change(textarea, { target: { value: 'First question' } });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(screen.getByText('First draft answer text.')).toBeDefined();
    });

    // Second draft
    fireEvent.change(textarea, { target: { value: 'Second question' } });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(screen.getByText('Second draft completely replacing the previous one.')).toBeDefined();
      expect(screen.queryByText('First draft answer text.')).toBeNull();
    });
  });

  it('a backend error shows its message and detail', async () => {
    const apiError = new ApiError('AI Provider Error', 500, 'Quota exceeded on model');
    vi.spyOn(draftApi, 'draftAnswer').mockRejectedValue(apiError);

    render(<DraftPage profile={sampleProfile} job={sampleJob} />);

    const textarea = screen.getByLabelText('Question');
    fireEvent.change(textarea, { target: { value: 'Any question' } });

    const draftBtn = screen.getByRole('button', { name: 'Draft answer' });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('AI Provider Error');
      expect(alert.textContent).toContain('Quota exceeded on model');
    });
  });
});
