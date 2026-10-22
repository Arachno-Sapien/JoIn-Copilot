import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from '../../lib/api/client';
import { draftAnswer } from '../../lib/api/draft';
import { DraftRequest, DraftResponse } from '../../lib/schemas/draft';
import { Profile } from '../../lib/schemas/profile';
import { Job } from '../../lib/schemas/job';

describe('leaf-1.2.2:G7 Extension /draft Wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockImplementation((keys: any, cb?: any) => {
            const result = { backendUrl: 'http://127.0.0.1:8000' };
            if (typeof cb === 'function') cb(result);
            return Promise.resolve(result);
          }),
        },
      },
    };
  });

  const validProfile: Profile = {
    schema_version: 1,
    name: 'Alex Doe',
    email: 'alex@example.com',
    phone: '+1234567890',
    location: 'Bangalore, India',
    links: {},
    education: [],
    experience: [
      {
        id: 'exp-1',
        role: 'Software Engineer',
        org: 'Tech Corp',
        start: '2022',
        end: 'present',
        bullets: [{ id: 'exp-1-b1', text: 'Built APIs with Python and FastAPI' }],
      },
    ],
    projects: [],
    skills: [{ name: 'Python', level: 'strong' }],
    certifications: [],
    preferences: {
      locations: ['Bangalore'],
      remote: 'any',
      job_types: ['full-time'],
      min_stipend: null,
      avoid_keywords: [],
    },
  };

  const validJob: Job = {
    id: 'job-1',
    source: 'manual',
    source_id: '1',
    url: 'https://example.com/jobs/1',
    title: 'Python Backend Engineer',
    company: 'Acme Corp',
    location: 'Bangalore',
    remote: 'hybrid',
    job_type: 'full-time',
    required_skills: ['Python', 'FastAPI'],
    nice_to_have_skills: [],
    experience_years_min: 2,
    description: 'FastAPI and Python developer needed.',
    posted_at: '2026-10-18T00:00:00Z',
    deadline: null,
    fetched_at: '2026-10-18T10:00:00Z',
  };

  const sampleDraftResponse: DraftResponse = {
    draft: 'I have extensive experience with FastAPI [exp-1-b1].',
    claims: [
      {
        claim: 'I have extensive experience with FastAPI.',
        verdict: 'supported',
        reason: 'Direct match with exp-1-b1',
        cited_ids: ['exp-1-b1'],
        is_flagged: false,
      },
    ],
    flagged_spans: [],
    rewrite: 'I have extensive experience with FastAPI.',
  };

  it('posts draft request and parses response into validated DraftResponse', async () => {
    let capturedBody: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url: any, init: any) => {
      expect(url).toBe('http://127.0.0.1:8000/draft');
      expect(init.method).toBe('POST');
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify(sampleDraftResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new ApiClient();
    const req: DraftRequest = {
      job: validJob,
      question: 'Why are you a great fit?',
      profile: validProfile,
    };

    const resp = await draftAnswer(client, req);

    expect(capturedBody).toEqual(req);
    expect(resp.draft).toContain('FastAPI');
    expect(resp.claims).toHaveLength(1);
    expect(resp.claims[0].verdict).toBe('supported');
  });

  it('throws ApiError on server error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    await expect(
      draftAnswer(client, {
        job: validJob,
        question: 'Why are you a fit?',
        profile: validProfile,
      })
    ).rejects.toThrow(ApiError);
  });
});
