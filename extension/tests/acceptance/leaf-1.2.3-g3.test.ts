import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from '../../lib/api/client';
import { mapFields } from '../../lib/api/fill';
import { MapFieldsRequest, MapFieldsResponse } from '../../lib/schemas/fill';
import { Profile } from '../../lib/schemas/profile';

describe('leaf-1.2.3:G3 Extension /fill/map-fields Wrapper', () => {
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
    links: { linkedin: 'https://linkedin.com/in/alexdoe' },
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certifications: [],
    preferences: {
      locations: [],
      remote: 'any',
      job_types: [],
      min_stipend: null,
      avoid_keywords: [],
    },
  };

  const sampleResponse: MapFieldsResponse = {
    mappings: [
      {
        field_id: 'input-name',
        field_name: 'Full Name',
        action: 'fill',
        profile_path: 'name',
        value: 'Alex Doe',
        is_open_question: false,
        is_flagged: false,
      },
      {
        field_id: 'input-essay',
        field_name: 'Why our company?',
        action: 'open_question',
        profile_path: null,
        value: null,
        is_open_question: true,
        is_flagged: false,
      },
    ],
  };

  it('posts map-fields request and parses response into validated MapFieldsResponse', async () => {
    let capturedBody: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url: any, init: any) => {
      expect(url).toBe('http://127.0.0.1:8000/fill/map-fields');
      expect(init.method).toBe('POST');
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify(sampleResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new ApiClient();
    const req: MapFieldsRequest = {
      profile: validProfile,
      fields: [
        { id: 'input-name', label: 'Full Name', type: 'text' },
        { id: 'input-essay', label: 'Why our company?', type: 'textarea' },
      ],
    };

    const resp = await mapFields(client, req);

    expect(capturedBody).toEqual(req);
    expect(resp.mappings).toHaveLength(2);
    expect(resp.mappings[0].action).toBe('fill');
    expect(resp.mappings[0].value).toBe('Alex Doe');
    expect(resp.mappings[1].is_open_question).toBe(true);
  });

  it('throws ApiError on server failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    await expect(
      mapFields(client, {
        profile: validProfile,
        fields: [],
      })
    ).rejects.toThrow(ApiError);
  });
});
