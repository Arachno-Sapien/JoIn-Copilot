// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { JobList } from '../../components/sidepanel/JobList';
import { ScoredJob } from '../../lib/schemas/search';

afterEach(() => {
  cleanup();
});

describe('leaf-1.3.3:G3 Ranked Job List View', () => {
  const rankedJobs: ScoredJob[] = [
    {
      job: {
        id: 'job-1',
        title: 'Full Stack Engineer',
        company: 'Cloudflare',
        location: 'Austin, TX',
        url: 'https://boards.greenhouse.io/cloudflare/jobs/1',
        source: 'greenhouse',
      },
      score: 88,
      breakdown: {
        matched_required: ['React', 'TypeScript', 'Node.js'],
        missing_required: ['GraphQL'],
        matched_nice_to_have: ['Rust'],
        summary: 'Exceptional skill overlap with standard modern stack requirements.',
      },
    },
    {
      job: {
        id: 'job-2',
        title: 'Platform Engineer',
        company: 'Vercel',
        location: 'Remote',
        url: 'https://jobs.lever.co/vercel/2',
        source: 'lever',
      },
      score: 74,
      breakdown: {
        matched_required: ['Go', 'Docker'],
        missing_required: ['Kubernetes', 'Terraform'],
        matched_nice_to_have: [],
        summary: 'Strong backend systems skills but requires infrastructure tooling experience.',
      },
    },
  ];

  it('shows each ranked job with title, company, fit score, fit summary/reasons, and missing skills', () => {
    render(<JobList jobs={rankedJobs} />);

    // Job 1
    expect(screen.getByText('Full Stack Engineer')).toBeDefined();
    expect(screen.getByText('Cloudflare')).toBeDefined();
    expect(screen.getByText(/88/)).toBeDefined();
    expect(screen.getByText(/Exceptional skill overlap/i)).toBeDefined();
    expect(screen.getByText(/GraphQL/i)).toBeDefined();

    // Job 2
    expect(screen.getByText('Platform Engineer')).toBeDefined();
    expect(screen.getByText('Vercel')).toBeDefined();
    expect(screen.getByText(/74/)).toBeDefined();
    expect(screen.getByText(/Strong backend systems skills/i)).toBeDefined();
    expect(screen.getByText(/Kubernetes/i)).toBeDefined();
    expect(screen.getByText(/Terraform/i)).toBeDefined();
  });
});
