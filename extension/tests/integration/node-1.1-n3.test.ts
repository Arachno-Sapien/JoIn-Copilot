import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ApiClient } from '../../lib/api/client';
import { extractJob } from '../../lib/api/extract';
import { parseResume } from '../../lib/api/profile';
import { JobSchema } from '../../lib/schemas/job';
import { ProfileSchema } from '../../lib/schemas/profile';

describe('node-1.1:N3 Snapshot Integration Tests', () => {
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

  it('validates health snapshot with status ok', () => {
    const healthFile = path.join(snapshotsDir, 'health.json');
    expect(fs.existsSync(healthFile)).toBe(true);
    const healthJson = JSON.parse(fs.readFileSync(healthFile, 'utf8'));
    expect(healthJson.status).toBe('ok');
  });

  it('validates jobs_extract snapshot with JobSchema and extractJob wrapper', async () => {
    const extractFile = path.join(snapshotsDir, 'jobs_extract.json');
    expect(fs.existsSync(extractFile)).toBe(true);
    const extractJson = JSON.parse(fs.readFileSync(extractFile, 'utf8'));

    // 1. Direct Zod validation
    const parsedJob = JobSchema.parse(extractJson);
    expect(parsedJob.source).toBe('manual');
    expect(parsedJob.title).toBe(extractJson.title);
    expect(parsedJob.company).toBe(extractJson.company);

    // 2. Client wrapper test with snapshot returned by fetch
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(extractJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    const job = await extractJob(client, {
      text: 'Some raw text',
      url: extractJson.url,
    });
    expect(job.id).toBe(extractJson.id);
    expect(job.title).toBe(extractJson.title);
  });

  it('validates profile_parse snapshot with ProfileSchema and parseResume wrapper', async () => {
    const profileFile = path.join(snapshotsDir, 'profile_parse.json');
    expect(fs.existsSync(profileFile)).toBe(true);
    const profileJson = JSON.parse(fs.readFileSync(profileFile, 'utf8'));

    // 1. Direct Zod validation
    const parsedProfile = ProfileSchema.parse(profileJson);
    expect(parsedProfile.name).toBe('Alex Doe');
    expect(parsedProfile.email).toBe('alex@example.com');
    expect(parsedProfile.experience.length).toBeGreaterThan(0);

    // 2. Client wrapper test with snapshot returned by fetch
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(profileJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new ApiClient();
    const dummyBlob = new Blob(['%PDF-dummy'], { type: 'application/pdf' });
    const profile = await parseResume(client, dummyBlob);
    expect(profile.name).toBe(extractJsonName(profileJson));
    expect(profile.email).toBe(profileJson.email);
  });
});

function extractJsonName(json: any): string {
  return json.name;
}
