// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AddJob } from '../../../components/sidepanel/AddJob';
import * as extractApi from '../../../lib/api/extract';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openTab(url: string, executeScript = vi.fn().mockResolvedValue([{ result: 'Backend Engineer at Acme' }])) {
  (globalThis as any).chrome = {
    tabs: { query: vi.fn().mockResolvedValue([{ id: 7, url }]) },
    scripting: { executeScript },
  };
  return executeScript;
}

function clickAddJob() {
  render(<AddJob />);
  fireEvent.click(screen.getByRole('button', { name: /add job from page/i }));
}

describe('AddJob', () => {
  it('says which job sites it works on', () => {
    openTab('https://boards.greenhouse.io/acme/jobs/1');
    render(<AddJob />);
    expect(screen.getByText(/Greenhouse or Lever/)).toBeDefined();
  });

  // Project rule 5: never read LinkedIn or Naukri pages.
  it.each([
    'https://www.linkedin.com/jobs-tracker/?stage=applied',
    'https://in.linkedin.com/jobs/view/123',
    'https://www.naukri.com/job-listings-backend-engineer',
  ])('refuses %s without reading the page', async (url) => {
    const executeScript = openTab(url);
    clickAddJob();
    await waitFor(() => expect(screen.getByText(/doesn't read LinkedIn or Naukri/)).toBeDefined());
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('still reads sites that only look similar', async () => {
    const executeScript = openTab('https://jobs.notlinkedin.com/123');
    vi.spyOn(extractApi, 'extractJob').mockResolvedValue({ title: 'Backend Engineer' } as any);
    clickAddJob();
    await waitFor(() => expect(screen.getByText(/Backend Engineer added/)).toBeDefined());
    expect(executeScript).toHaveBeenCalled();
  });

  it("replaces Chrome's permission error with a plain message", async () => {
    openTab(
      'https://careers.example.com/jobs/1',
      vi.fn().mockRejectedValue(
        new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.')
      )
    );
    clickAddJob();
    await waitFor(() => expect(screen.getByText(/works on Greenhouse and Lever job pages/)).toBeDefined());
    expect(screen.queryByText(/manifest/)).toBeNull();
  });
});
