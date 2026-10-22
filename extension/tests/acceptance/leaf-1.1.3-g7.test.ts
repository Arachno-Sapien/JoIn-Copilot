import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from '../../lib/api/client';
import { extractJob } from '../../lib/api/extract';
import { ExtractJobRequest } from '../../lib/schemas/extract';
import { Job } from '../../lib/schemas/job';

describe('leaf-1.1.3:G7 Extension /jobs/extract Wrapper', () => {
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

  const validJobPayload: Job = {
    id: 'a1b2c3d4e5f6',
    source: 'manual',
    source_id: 'man-123',
    url: 'https://example.com/careers/software-eng',
    title: 'Senior Software Engineer',
    company: 'Acme Corp',
    location: 'Bangalore, India',
    remote: 'hybrid',
    job_type: 'full-time',
    required_skills: ['TypeScript', 'React'],
    nice_to_have_skills: ['FastAPI'],
    experience_years_min: 3,
    description: 'We are looking for a Senior Software Engineer.',
    posted_at: '2026-10-18T00:00:00Z',
    deadline: null,
    fetched_at: '2026-10-18T10:00:00Z',
  };

  it('posts page text and parses response into validated Job', async () => {
    let capturedBody: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url: any, init: any) => {
      expect(url).toBe('http://127.0.0.1:8000/jobs/extract');
      expect(init.method).toBe('POST');
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify(validJobPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new ApiClient();
    const req: ExtractJobRequest = {
      text: 'Acme Corp is hiring Senior Software Engineer in Bangalore...',
      url: 'https://example.com/careers/software-eng',
    };

    const job = await extractJob(client, req);

    expect(capturedBody).toEqual(req);
    expect(job.id).toBe(validJobPayload.id);
    expect(job.source).toBe('manual');
    expect(job.title).toBe('Senior Software Engineer');
    expect(job.company).toBe('Acme Corp');
    expect(job.required_skills).toEqual(['TypeScript', 'React']);
  });

  it('throws ApiError on server error or invalid response schema', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Internal Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    await expect(
      extractJob(client, { text: 'Some text', url: 'https://example.com' })
    ).rejects.toThrow(ApiError);
  });
});
