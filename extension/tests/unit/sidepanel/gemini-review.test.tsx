// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { App } from '../../../entrypoints/sidepanel/App';
import { DraftPage } from '../../../components/sidepanel/DraftPage';
import { FillReview } from '../../../components/sidepanel/FillReview';
import { db } from '../../../lib/db';
import * as draftApi from '../../../lib/api/draft';
import * as searchApi from '../../../lib/api/search';
import * as scamApi from '../../../lib/api/scam';

const profile: any = {
  schema_version: 1,
  name: 'Asha Rao',
  email: 'asha@example.test',
  phone: '',
  location: 'Pune',
  education: [],
  experience: [],
  projects: [],
  skills: [],
  certifications: [],
  preferences: { locations: [], remote: 'any' },
};

const job = (id: string, title: string): any => ({
  id,
  source: 'manual',
  source_id: id,
  url: `https://example.test/${id}`,
  title,
  company: 'Acme',
  location: 'Remote',
  remote: 'remote',
  job_type: 'full-time',
  required_skills: [],
  nice_to_have_skills: [],
  experience_years_min: null,
  description: 'A role',
  fetched_at: '2026-10-18T10:00:00Z',
});

const draft = (text: string, rewrite: string | null = null): any => ({
  draft: text,
  claims: [],
  flagged_spans: [],
  rewrite,
});

beforeEach(async () => {
  await db.profile.clear();
  await db.jobs.clear();
  (globalThis as any).chrome = {
    tabs: { query: vi.fn(async () => [{ id: 9, url: 'https://example.test/apply' }]) },
    storage: { local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue({}) } },
    runtime: { getManifest: vi.fn().mockReturnValue({}) },
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Draft tab', () => {
  const writeDraft = async (question: string) => {
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: question } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft answer' }));
  };

  it('shows each job its own draft after switching back to an earlier job', async () => {
    vi.spyOn(draftApi, 'draftAnswer')
      .mockResolvedValueOnce(draft('Draft for the first job.'))
      .mockResolvedValueOnce(draft('Draft for the second job.'));
    const first = job('a', 'First role');
    const second = job('b', 'Second role');

    const view = render(<DraftPage profile={profile} job={first} />);
    await writeDraft('Why us?');
    await screen.findByText('Draft for the first job.');

    view.rerender(<DraftPage profile={profile} job={second} />);
    await writeDraft('Why us?');
    await screen.findByText('Draft for the second job.');

    view.rerender(<DraftPage profile={profile} job={first} />);
    expect(screen.getByText('Draft for the first job.')).toBeDefined();
    expect(screen.queryByText('Draft for the second job.')).toBeNull();
  });

  it('copies the draft on screen, not a rewrite the user has not applied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.spyOn(draftApi, 'draftAnswer').mockResolvedValueOnce(draft('What the user sees.', 'A hidden rewrite.'));

    render(<DraftPage profile={profile} job={job('a', 'First role')} />);
    await writeDraft('Why us?');
    await screen.findByText('What the user sees.');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('What the user sees.'));
  });
});

describe('Fill review', () => {
  it('does not claim an answer was filled when the page skipped the field', async () => {
    const field = { name: 'essay', label: 'Why us?' };
    (globalThis as any).chrome.tabs.sendMessage = vi.fn(async () => ({ filled: [], skipped: [field] }));
    vi.spyOn(draftApi, 'draftAnswer').mockResolvedValue(draft('An answer.'));

    render(<FillReview filled={[]} skipped={[]} openQuestions={[field]} selectedJob={job('a', 'Role')} profile={profile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Draft answer' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use this answer' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be filled/i);
    expect(screen.queryByText('Answer filled on page!')).toBeNull();
  });
});

describe('Jobs tab', () => {
  it('says so when Find jobs matched nothing', async () => {
    vi.spyOn(searchApi, 'searchJobs').mockResolvedValue({ results: [], total_evaluated: 5 });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Find jobs' }));
    expect(await screen.findByText(/None of the 5 jobs/)).toBeDefined();
  });

  it('does not bring back a job removed while its scam check was running', async () => {
    const ranked = { job: job('a', 'First role'), fit_score: null, fit_reasons: [], missing_skills: [] };
    await db.jobs.put({ id: 'a', ranked, savedAt: '2026-10-18T10:00:00Z' });
    let finish!: (value: any) => void;
    vi.spyOn(scamApi, 'checkJobScam').mockReturnValue(new Promise((resolve) => (finish = resolve)));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }));
    fireEvent.click(await screen.findByTestId('job-card'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove First role' }));
    await waitFor(async () => expect(await db.jobs.get('a')).toBeUndefined());

    finish({ risk_level: 'low', reasons: [] });
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.jobs.get('a')).toBeUndefined();
  });
});
