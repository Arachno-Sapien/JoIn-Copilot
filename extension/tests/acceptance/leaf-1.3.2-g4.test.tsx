// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TrackerTable } from '../../components/tracker/TrackerTable';
import { Application } from '../../lib/schemas/application';

afterEach(() => {
  cleanup();
});

describe('leaf-1.3.2:G4 Tracker Table Filtering and Sorting', () => {
  const sampleApplications: Application[] = [
    {
      schema_version: 1,
      id: 'app-1',
      job_id: 'job-1',
      job_snapshot: { title: 'Junior Dev', company: 'Alpha Inc', url: 'https://boards.greenhouse.io/1', source: 'greenhouse' },
      applied_at: '2026-01-10T10:00:00Z',
      fit_score: 70,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [{ status: 'applied', at: '2026-01-10T10:00:00Z', source: 'user' }],
      notes: '',
    },
    {
      schema_version: 1,
      id: 'app-2',
      job_id: 'job-2',
      job_snapshot: { title: 'Senior Dev', company: 'Beta Corp', url: 'https://jobs.lever.co/2', source: 'lever' },
      applied_at: '2026-02-15T12:00:00Z',
      fit_score: 95,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'interview',
      status_history: [{ status: 'applied', at: '2026-02-15T12:00:00Z', source: 'user' }],
      notes: '',
    },
    {
      schema_version: 1,
      id: 'app-3',
      job_id: 'job-3',
      job_snapshot: { title: 'Lead Dev', company: 'Gamma LLC', url: 'https://boards.greenhouse.io/3', source: 'greenhouse' },
      applied_at: '2026-01-05T08:00:00Z',
      fit_score: 80,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'rejected',
      status_history: [{ status: 'applied', at: '2026-01-05T08:00:00Z', source: 'user' }],
      notes: '',
    },
  ];

  it('renders all applications initially and filters by status', () => {
    render(<TrackerTable applications={sampleApplications} />);

    expect(screen.getByText('Alpha Inc')).toBeDefined();
    expect(screen.getByText('Beta Corp')).toBeDefined();
    expect(screen.getByText('Gamma LLC')).toBeDefined();

    // Filter by 'interview'
    const filterSelect = screen.getByLabelText(/filter by status/i) as HTMLSelectElement;
    fireEvent.change(filterSelect, { target: { value: 'interview' } });

    expect(screen.queryByText('Alpha Inc')).toBeNull();
    expect(screen.getByText('Beta Corp')).toBeDefined();
    expect(screen.queryByText('Gamma LLC')).toBeNull();
  });

  it('sorts applications by applied date ascending and descending', () => {
    render(<TrackerTable applications={sampleApplications} />);

    const sortSelect = screen.getByLabelText(/sort by/i) as HTMLSelectElement;

    // Sort ascending (oldest first: Gamma Jan 5, Alpha Jan 10, Beta Feb 15)
    fireEvent.change(sortSelect, { target: { value: 'applied_asc' } });
    let rows = screen.getAllByTestId('tracker-row');
    expect(rows[0].textContent).toContain('Gamma LLC');
    expect(rows[1].textContent).toContain('Alpha Inc');
    expect(rows[2].textContent).toContain('Beta Corp');

    // Sort descending (newest first: Beta Feb 15, Alpha Jan 10, Gamma Jan 5)
    fireEvent.change(sortSelect, { target: { value: 'applied_desc' } });
    rows = screen.getAllByTestId('tracker-row');
    expect(rows[0].textContent).toContain('Beta Corp');
    expect(rows[1].textContent).toContain('Alpha Inc');
    expect(rows[2].textContent).toContain('Gamma LLC');
  });
});
