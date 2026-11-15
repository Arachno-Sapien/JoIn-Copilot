import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScamCheckResponseSchema } from '../../../lib/schemas/scam';
import { checkJobScam } from '../../../lib/api/scam';
import { apiClient } from '../../../lib/api/client';

describe('Scam schemas and API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates a valid scam check response', () => {
    const validData = {
      job_id: 'job-123',
      risk_level: 'high',
      reasons: ['Demands upfront payment'],
      rule_signals: ['fee_detected'],
      llm_flags: ['suspicious_contact'],
      injection_warning: 'Ignore previous instructions detected',
    };

    const parsed = ScamCheckResponseSchema.parse(validData);
    expect(parsed.job_id).toBe('job-123');
    expect(parsed.risk_level).toBe('high');
    expect(parsed.reasons).toHaveLength(1);
    expect(parsed.injection_warning).toBe('Ignore previous instructions detected');
  });

  it('provides default empty arrays for optional lists', () => {
    const minimalData = {
      job_id: 'job-safe',
      risk_level: 'low',
    };

    const parsed = ScamCheckResponseSchema.parse(minimalData);
    expect(parsed.reasons).toEqual([]);
    expect(parsed.rule_signals).toEqual([]);
    expect(parsed.llm_flags).toEqual([]);
    expect(parsed.injection_warning).toBeUndefined();
  });

  it('calls apiClient.post with the encoded jobId', async () => {
    const mockResponse = {
      job_id: 'job/with:special/chars',
      risk_level: 'low' as const,
      reasons: [],
      rule_signals: [],
      llm_flags: [],
      injection_warning: null,
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(mockResponse);

    const result = await checkJobScam('job/with:special/chars');
    expect(postSpy).toHaveBeenCalledWith(
      '/jobs/job%2Fwith%3Aspecial%2Fchars/scam-check',
      {},
      ScamCheckResponseSchema
    );
    expect(result.job_id).toBe('job/with:special/chars');
  });

  it('calls apiClient.post with the job in the body when passed a Job object', async () => {
    const job = {
      id: 'job-manual-456',
      source: 'manual' as const,
      source_id: 's456',
      url: 'https://example.com/job',
      title: 'Dev',
      company: 'Startup',
      location: 'Remote',
      remote: 'remote' as const,
      job_type: 'full-time' as const,
      required_skills: [],
      nice_to_have_skills: [],
      description: 'Job desc',
      fetched_at: '2026-10-18T10:00:00Z',
    };

    const mockResponse = {
      job_id: 'job-manual-456',
      risk_level: 'low' as const,
      reasons: [],
      rule_signals: [],
      llm_flags: [],
      injection_warning: null,
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(mockResponse);

    const result = await checkJobScam(job);
    expect(postSpy).toHaveBeenCalledWith(
      '/jobs/job-manual-456/scam-check',
      { job },
      ScamCheckResponseSchema
    );
    expect(result.job_id).toBe('job-manual-456');
  });
});
