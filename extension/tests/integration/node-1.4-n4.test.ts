import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { classifyEmail } from '../../lib/api/email';
import { checkJobScam } from '../../lib/api/scam';
import { EmailClassifyResponseSchema } from '../../lib/schemas/email';
import { ScamCheckResponseSchema } from '../../lib/schemas/scam';

describe('node-1.4:N4 Snapshot Integration Tests', () => {
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

  it('validates email_classify snapshot with EmailClassifyResponseSchema and classifyEmail wrapper', async () => {
    const emailFile = path.join(snapshotsDir, 'email_classify.json');
    expect(fs.existsSync(emailFile)).toBe(true);
    const emailJson = JSON.parse(fs.readFileSync(emailFile, 'utf8'));

    // 1. Direct schema parse
    const parsed = EmailClassifyResponseSchema.parse(emailJson);
    expect(parsed.classification).toBe('interview');
    expect(parsed.confidence).toBeGreaterThan(0.5);

    // 2. Client wrapper
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(emailJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const emailInput = {
      sender: 'recruiter@acme.com',
      subject: 'Interview invite',
      date: '2026-10-18T12:00:00Z',
      body: 'Would love to interview you.',
    };
    const candidates = [{ id: 'app-123', company: 'Acme Corp', role: 'Software Engineer' }];

    const resp = await classifyEmail(emailInput, candidates);
    expect(resp.classification).toBe('interview');
    expect(resp.matched_application_id).toBe('app-123');
  });

  it('validates scam_check snapshot with ScamCheckResponseSchema and checkJobScam wrapper', async () => {
    const scamFile = path.join(snapshotsDir, 'scam_check.json');
    expect(fs.existsSync(scamFile)).toBe(true);
    const scamJson = JSON.parse(fs.readFileSync(scamFile, 'utf8'));

    // 1. Direct schema parse
    const parsed = ScamCheckResponseSchema.parse(scamJson);
    expect(['low', 'medium', 'high']).toContain(parsed.risk_level);
    expect(parsed.job_id).toBe('job-node14-safe');

    // 2. Client wrapper
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(scamJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const resp = await checkJobScam('job-node14-safe');
    expect(resp.risk_level).toBe('low');
    expect(resp.job_id).toBe('job-node14-safe');
  });
});
