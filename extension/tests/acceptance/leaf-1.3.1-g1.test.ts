// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { greenhouseAdapter } from '../../adapters/greenhouse';
import { leverAdapter } from '../../adapters/lever';
import { genericAdapter } from '../../adapters/generic';

describe('leaf-1.3.1:G1 Site Adapters Interface and URL Matching', () => {
  const adapters = [
    { name: 'Greenhouse', adapter: greenhouseAdapter },
    { name: 'Lever', adapter: leverAdapter },
    { name: 'Generic', adapter: genericAdapter },
  ];

  it('each adapter implements all required interface methods', () => {
    for (const { name, adapter } of adapters) {
      expect(typeof adapter.matches, `${name} has matches`).toBe('function');
      expect(typeof adapter.extractJob, `${name} has extractJob`).toBe('function');
      expect(typeof adapter.findFormRoot, `${name} has findFormRoot`).toBe('function');
      expect(typeof adapter.listFields, `${name} has listFields`).toBe('function');
      expect(typeof adapter.fillField, `${name} has fillField`).toBe('function');
      expect(typeof adapter.detectSubmission, `${name} has detectSubmission`).toBe('function');
    }
  });

  it('Greenhouse adapter matches only its own job URLs', () => {
    expect(greenhouseAdapter.matches(new URL('https://boards.greenhouse.io/company/jobs/1234567'))).toBe(true);
    expect(greenhouseAdapter.matches(new URL('https://job-boards.greenhouse.io/company/jobs/7654321'))).toBe(true);
    // Negative matches
    expect(greenhouseAdapter.matches(new URL('https://boards.greenhouse.io/company'))).toBe(false);
    expect(greenhouseAdapter.matches(new URL('https://jobs.lever.co/company/abc-123'))).toBe(false);
    expect(greenhouseAdapter.matches(new URL('https://example.com/careers/job1'))).toBe(false);
  });

  it('Lever adapter matches only its own job URLs', () => {
    expect(leverAdapter.matches(new URL('https://jobs.lever.co/company/abc-123-def'))).toBe(true);
    // Negative matches
    expect(leverAdapter.matches(new URL('https://jobs.lever.co/company'))).toBe(false);
    expect(leverAdapter.matches(new URL('https://boards.greenhouse.io/company/jobs/1234567'))).toBe(false);
    expect(leverAdapter.matches(new URL('https://example.com/careers/job1'))).toBe(false);
  });

  it('Generic adapter provides fallback matching', () => {
    expect(genericAdapter.matches(new URL('https://example.com/careers/job1'))).toBe(true);
    expect(genericAdapter.matches(new URL('https://custom-ats.io/apply'))).toBe(true);
  });
});
