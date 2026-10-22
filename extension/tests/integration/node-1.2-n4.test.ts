import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ApiClient } from '../../lib/api/client';
import { searchJobs } from '../../lib/api/search';
import { draftAnswer } from '../../lib/api/draft';
import { mapFields } from '../../lib/api/fill';
import { SearchResponseSchema } from '../../lib/schemas/search';
import { DraftResponseSchema } from '../../lib/schemas/draft';
import { MapFieldsResponseSchema } from '../../lib/schemas/fill';

describe('node-1.2:N4 Snapshot Integration Tests', () => {
  const snapshotsDir = path.resolve(__dirname, '../../../backend/tests/snapshots');

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

  it('validates jobs_search snapshot with SearchResponseSchema and searchJobs wrapper', async () => {
    const searchFile = path.join(snapshotsDir, 'jobs_search.json');
    expect(fs.existsSync(searchFile)).toBe(true);
    const searchJson = JSON.parse(fs.readFileSync(searchFile, 'utf8'));

    // 1. Direct schema parse
    const parsed = SearchResponseSchema.parse(searchJson);
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0].fit_score).toBeGreaterThan(0);

    // 2. Client wrapper
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(searchJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    const resp = await searchJobs(client, {
      profile: {
        schema_version: 1,
        name: 'Test',
        email: 't@e.com',
        phone: '1',
        location: 'X',
        links: {},
        education: [],
        experience: [],
        projects: [],
        skills: [],
        certifications: [],
        preferences: { locations: [], remote: 'any', job_types: [], min_stipend: null, avoid_keywords: [] },
      },
    });

    expect(resp.results).toHaveLength(parsed.results.length);
    expect(resp.results[0].job.title).toBe(parsed.results[0].job.title);
  });

  it('validates draft snapshot with DraftResponseSchema and draftAnswer wrapper', async () => {
    const draftFile = path.join(snapshotsDir, 'draft.json');
    expect(fs.existsSync(draftFile)).toBe(true);
    const draftJson = JSON.parse(fs.readFileSync(draftFile, 'utf8'));

    // 1. Direct schema parse
    const parsed = DraftResponseSchema.parse(draftJson);
    expect(parsed.draft).toBeTruthy();
    expect(parsed.claims.length).toBeGreaterThan(0);

    // 2. Client wrapper
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(draftJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    const resp = await draftAnswer(client, {
      job: {
        id: '1',
        source: 'manual',
        source_id: '1',
        url: 'https://e.com',
        title: 'T',
        company: 'C',
        location: 'L',
        remote: 'hybrid',
        job_type: 'full-time',
        required_skills: [],
        nice_to_have_skills: [],
        description: 'D',
        fetched_at: '2026-10-18T00:00:00Z',
      },
      question: 'Why?',
      profile: {
        schema_version: 1,
        name: 'Test',
        email: 't@e.com',
        phone: '1',
        location: 'X',
        links: {},
        education: [],
        experience: [],
        projects: [],
        skills: [],
        certifications: [],
        preferences: { locations: [], remote: 'any', job_types: [], min_stipend: null, avoid_keywords: [] },
      },
    });

    expect(resp.draft).toBe(parsed.draft);
  });

  it('validates fill_map_fields snapshot with MapFieldsResponseSchema and mapFields wrapper', async () => {
    const fillFile = path.join(snapshotsDir, 'fill_map_fields.json');
    expect(fs.existsSync(fillFile)).toBe(true);
    const fillJson = JSON.parse(fs.readFileSync(fillFile, 'utf8'));

    // 1. Direct schema parse
    const parsed = MapFieldsResponseSchema.parse(fillJson);
    expect(parsed.mappings.length).toBeGreaterThan(0);

    // 2. Client wrapper
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(fillJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    const resp = await mapFields(client, {
      profile: {
        schema_version: 1,
        name: 'Test',
        email: 't@e.com',
        phone: '1',
        location: 'X',
        links: {},
        education: [],
        experience: [],
        projects: [],
        skills: [],
        certifications: [],
        preferences: { locations: [], remote: 'any', job_types: [], min_stipend: null, avoid_keywords: [] },
      },
      fields: [],
    });

    expect(resp.mappings).toHaveLength(parsed.mappings.length);
  });
});
