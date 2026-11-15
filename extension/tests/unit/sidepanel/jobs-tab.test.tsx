// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { App } from '../../../entrypoints/sidepanel/App';
import { db } from '../../../lib/db';
import * as searchApi from '../../../lib/api/search';
import * as scamApi from '../../../lib/api/scam';
import * as extractApi from '../../../lib/api/extract';

beforeEach(async () => {
  await db.profile.clear();
  await db.jobs.clear();
  await db.applications.clear();
  vi.restoreAllMocks();

  (globalThis as any).chrome = {
    tabs: { query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com/job/1' }]) },
    scripting: { executeScript: vi.fn().mockResolvedValue([{ result: 'Software Engineer at Acme Corp' }]) },
    storage: { local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue({}) } },
    runtime: { getManifest: vi.fn().mockReturnValue({}) },
  };
});

afterEach(() => {
  cleanup();
});

const sampleProfile = {
  id: 'main',
  schema_version: 1,
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-0100',
  location: 'Remote',
  education: [],
  experience: [],
  projects: [],
  skills: [{ name: 'React', level: 'strong' as const }],
  certifications: [],
  preferences: { locations: [], remote: 'remote' },
};

const sampleJob = {
  id: 'job-101',
  source: 'manual' as const,
  source_id: '101',
  url: 'https://example.com/job/101',
  title: 'Full Stack Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  remote: 'remote' as const,
  job_type: 'full-time' as const,
  required_skills: ['React'],
  nice_to_have_skills: [],
  experience_years_min: 2,
  description: 'Great role at Acme',
  fetched_at: '2026-10-18T10:00:00Z',
};

describe('Jobs Tab in Sidepanel App', () => {
  it('adding a job with a profile calls searchJobs with jobs: [job] and shows returned score', async () => {
    await db.profile.put(sampleProfile);

    vi.spyOn(extractApi, 'extractJob').mockResolvedValue(sampleJob);
    const searchSpy = vi.spyOn(searchApi, 'searchJobs').mockResolvedValue({
      results: [
        {
          job: sampleJob,
          fit_score: 92,
          fit_reasons: ['Skill match'],
          missing_skills: [],
        },
      ],
      total_evaluated: 1,
    });

    render(<App />);

    // Initial tab is Profile, wait for loaded profile to appear in editor
    await waitFor(() => {
      expect(screen.getByDisplayValue('Jane Doe')).toBeDefined();
    });

    // Switch to Jobs tab
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }));

    // Click Add Job from Page
    fireEvent.click(screen.getByRole('button', { name: /add job from page/i }));

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          jobs: [sampleJob],
          limit: 1,
        })
      );
      expect(screen.getByText('Fit 92%')).toBeDefined();
    });
  });

  it('adding a job without a profile shows Not scored', async () => {
    vi.spyOn(extractApi, 'extractJob').mockResolvedValue(sampleJob);
    const searchSpy = vi.spyOn(searchApi, 'searchJobs');

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }));
    fireEvent.click(screen.getByRole('button', { name: /add job from page/i }));

    await waitFor(() => {
      expect(screen.getByText('Full Stack Engineer')).toBeDefined();
      expect(screen.getByText('Not scored')).toBeDefined();
    });
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('Find jobs shows results, and shows empty-cache message when total_evaluated is 0', async () => {
    const searchSpy = vi.spyOn(searchApi, 'searchJobs').mockResolvedValueOnce({
      results: [],
      total_evaluated: 0,
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }));

    const findBtn = screen.getByRole('button', { name: 'Find jobs' });
    fireEvent.click(findBtn);

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalled();
      expect(screen.getByText(/The backend has no jobs yet/i)).toBeDefined();
    });

    // Now mock search returning jobs
    searchSpy.mockResolvedValueOnce({
      results: [
        {
          job: sampleJob,
          fit_score: 85,
          fit_reasons: [],
          missing_skills: [],
        },
      ],
      total_evaluated: 5,
    });

    fireEvent.click(findBtn);

    await waitFor(() => {
      expect(screen.getByText('Full Stack Engineer')).toBeDefined();
      expect(screen.getByText('Fit 85%')).toBeDefined();
    });
  });

  it('selecting a job calls checkJobScam once and shows the risk badge', async () => {
    await db.jobs.put({
      id: sampleJob.id,
      ranked: {
        job: sampleJob,
        fit_score: 80,
        fit_reasons: [],
        missing_skills: [],
      },
      savedAt: new Date().toISOString(),
    });

    const scamSpy = vi.spyOn(scamApi, 'checkJobScam').mockResolvedValue({
      job_id: sampleJob.id,
      risk_level: 'high',
      reasons: ['Suspicious fee requested'],
      rule_signals: ['fee_detected'],
      llm_flags: [],
      injection_warning: null,
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }));

    await waitFor(() => {
      expect(screen.getByText('Full Stack Engineer')).toBeDefined();
    });

    const jobCard = screen.getByTestId('job-card');
    fireEvent.click(jobCard);

    await waitFor(() => {
      expect(scamSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/HIGH Risk/i)).toBeDefined();
      expect(screen.getByText('Suspicious fee requested')).toBeDefined();
    });

    // Clicking again should not call checkJobScam again
    fireEvent.click(jobCard);
    expect(scamSpy).toHaveBeenCalledTimes(1);
  });

  it('saved jobs are read back from Dexie on mount', async () => {
    await db.jobs.put({
      id: 'persisted-1',
      ranked: {
        job: { ...sampleJob, id: 'persisted-1', title: 'Persisted Cloud Architect' },
        fit_score: 88,
        fit_reasons: [],
        missing_skills: [],
      },
      savedAt: new Date().toISOString(),
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }));

    await waitFor(() => {
      expect(screen.getByText('Persisted Cloud Architect')).toBeDefined();
      expect(screen.getByText('Fit 88%')).toBeDefined();
    });
  });
});
