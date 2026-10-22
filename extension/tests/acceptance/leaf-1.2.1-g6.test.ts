import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from '../../lib/api/client';
import { searchJobs } from '../../lib/api/search';
import { SearchRequest, SearchResponse } from '../../lib/schemas/search';
import { Profile } from '../../lib/schemas/profile';

describe('leaf-1.2.1:G6 Extension /jobs/search Wrapper', () => {
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
    skills: [
      { name: 'Python', level: 'strong' },
      { name: 'FastAPI', level: 'strong' },
    ],
    certifications: [],
    preferences: {
      locations: ['Bangalore'],
      remote: 'any',
      job_types: ['full-time'],
      min_stipend: null,
      avoid_keywords: [],
    },
  };

  const sampleSearchResponse: SearchResponse = {
    results: [
      {
        job: {
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
          nice_to_have_skills: ['Docker'],
          experience_years_min: 2,
          description: 'FastAPI and Python developer needed.',
          posted_at: '2026-10-18T00:00:00Z',
          deadline: null,
          fetched_at: '2026-10-18T10:00:00Z',
        },
        fit_score: 95.0,
        fit_reasons: ['Matched required skills: Python, FastAPI', 'Strong experience alignment'],
        missing_skills: [],
      },
    ],
    total_evaluated: 1,
  };

  it('posts search request and parses response into validated SearchResponse', async () => {
    let capturedBody: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url: any, init: any) => {
      expect(url).toBe('http://127.0.0.1:8000/jobs/search');
      expect(init.method).toBe('POST');
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify(sampleSearchResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new ApiClient();
    const req: SearchRequest = {
      profile: validProfile,
    };

    const resp = await searchJobs(client, req);

    expect(capturedBody).toEqual(req);
    expect(resp.results).toHaveLength(1);
    expect(resp.results[0].fit_score).toBe(95.0);
    expect(resp.results[0].job.title).toBe('Python Backend Engineer');
    expect(resp.results[0].fit_reasons).toContain('Matched required skills: Python, FastAPI');
  });

  it('throws ApiError on server error or invalid response schema', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    await expect(searchJobs(client, { profile: validProfile })).rejects.toThrow(ApiError);
  });
});
