// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { greenhouseAdapter } from '../../../adapters/greenhouse';
import { leverAdapter } from '../../../adapters/lever';
import { genericAdapter, getAdapterForUrl } from '../../../adapters';

describe('Adapters Unit Tests', () => {
  it('selects correct adapter by URL', () => {
    const ghUrl = new URL('https://boards.greenhouse.io/stripe/jobs/12345');
    expect(getAdapterForUrl(ghUrl)).toBe(greenhouseAdapter);

    const leverUrl = new URL('https://jobs.lever.co/stripe/abc-123');
    expect(getAdapterForUrl(leverUrl)).toBe(leverAdapter);

    const otherUrl = new URL('https://example.com/careers/engineer');
    expect(getAdapterForUrl(otherUrl)).toBe(genericAdapter);
  });

  it('extracts job details from DOM', () => {
    document.body.innerHTML = `
      <h1 class="app-title">Staff Engineer</h1>
      <span class="company-name">Acme</span>
      <div class="location">Remote</div>
      <div id="content">Job description text</div>
    `;

    const job = greenhouseAdapter.extractJob(document);
    expect(job.title).toBe('Staff Engineer');
    expect(job.company).toBe('Acme');
    expect(job.location).toBe('Remote');
    expect(job.description).toBe('Job description text');
  });
});
