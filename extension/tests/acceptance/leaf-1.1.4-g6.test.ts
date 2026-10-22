import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from '../../lib/api/client';
import { parseResume } from '../../lib/api/profile';
import { Profile } from '../../lib/schemas/profile';

describe('leaf-1.1.4:G6 Extension /profile/parse Wrapper', () => {
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
    location: 'San Francisco, CA',
    links: {
      linkedin: 'https://linkedin.com/in/alexdoe',
      github: 'https://github.com/alexdoe',
    },
    education: [
      {
        id: 'edu-1',
        degree: 'B.S. CS',
        institution: 'University',
        start: '2018',
        end: '2022',
        score: null,
      },
    ],
    experience: [
      {
        id: 'exp-1',
        role: 'Software Engineer',
        org: 'Tech Corp',
        start: '2022',
        end: 'present',
        bullets: [{ id: 'exp-1-b1', text: 'Built scalable APIs' }],
      },
    ],
    projects: [
      {
        id: 'proj-1',
        name: 'Job Copilot',
        bullets: [{ id: 'proj-1-b1', text: 'Browser extension for job search' }],
      },
    ],
    skills: [{ name: 'TypeScript', level: 'strong' }],
    certifications: [],
    preferences: {
      locations: ['San Francisco'],
      remote: 'hybrid',
      job_types: ['full-time'],
      min_stipend: null,
      avoid_keywords: [],
    },
  };

  it('uploads PDF file as multipart and parses response into validated Profile', async () => {
    let capturedBody: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url: any, init: any) => {
      expect(url).toBe('http://127.0.0.1:8000/profile/parse');
      expect(init.method).toBe('POST');
      expect(init.body instanceof FormData).toBe(true);
      capturedBody = init.body;
      return new Response(JSON.stringify(validProfile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new ApiClient();
    const dummyBlob = new Blob(['%PDF-1.4 dummy content'], { type: 'application/pdf' });

    const profile = await parseResume(client, dummyBlob);

    expect(capturedBody).not.toBeNull();
    expect(profile.name).toBe('Alex Doe');
    expect(profile.email).toBe('alex@example.com');
    expect(profile.experience[0].bullets[0].id).toBe('exp-1-b1');
  });

  it('throws ApiError on 422 error response (such as scanned PDF)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'Unprocessable Entity',
          detail: 'Scanned or image-only PDF detected. Please upload a text-based resume.',
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const client = new ApiClient();
    const dummyBlob = new Blob(['%PDF-1.4 dummy scanned content'], { type: 'application/pdf' });

    await expect(parseResume(client, dummyBlob)).rejects.toThrow(ApiError);
  });
});
