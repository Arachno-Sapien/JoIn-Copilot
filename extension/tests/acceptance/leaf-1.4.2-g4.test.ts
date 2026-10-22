// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../lib/db';
import { exportDataAsJson, exportDataAsCsv } from '../../lib/export';
import { Profile } from '../../lib/schemas/profile';
import { Application } from '../../lib/schemas/application';

describe('leaf-1.4.2:G4 JSON and CSV export with full quoting support', () => {
  beforeEach(async () => {
    await db.profile.clear();
    await db.applications.clear();

    const profile: Profile = {
      schema_version: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1-555-0199',
      location: 'San Francisco, CA',
      links: {},
      education: [],
      experience: [],
      projects: [],
      skills: [],
      certifications: [],
      preferences: {
        desired_roles: ['Software Engineer'],
        locations: ['San Francisco, CA'],
        remote_only: false,
        minimum_salary: 150000,
        sponsorship_required: false,
      },
    };
    await db.profile.put({ ...profile, id: 'main' });

    const apps: Application[] = [
      {
        schema_version: 1,
        id: 'app-export-1',
        job_id: 'job-1',
        job_snapshot: {
          title: 'Senior "Lead" Engineer',
          company: 'Acme, Inc.',
          url: 'https://example.com',
          source: 'greenhouse',
        },
        applied_at: '2026-10-01T10:00:00Z',
        fit_score: 92,
        missing_skills: [],
        resume_version: 'v1',
        answers: [],
        status: 'applied',
        status_history: [{ status: 'applied', at: '2026-10-01T10:00:00Z', source: 'user' }],
        notes: 'First line\nSecond line with "quotes" and, commas.',
      },
    ];
    await db.applications.put(apps[0]);
  });

  it('produces valid JSON containing both profile and applications', async () => {
    const jsonStr = await exportDataAsJson();
    const parsed = JSON.parse(jsonStr);

    expect(parsed.profile).toBeDefined();
    expect(parsed.profile.name).toBe('Jane Doe');
    expect(parsed.applications).toBeInstanceOf(Array);
    expect(parsed.applications.length).toBe(1);
    expect(parsed.applications[0].job_snapshot.company).toBe('Acme, Inc.');
  });

  it('produces CSV with correct RFC 4180 quoting for commas, quotes, and newlines', async () => {
    const csvStr = await exportDataAsCsv();

    // Must have header
    expect(csvStr).toContain('id,company,title,status,applied_at,notes');

    // Values with commas must be quoted: "Acme, Inc."
    expect(csvStr).toContain('"Acme, Inc."');

    // Values with quotes must have doubled quotes: Senior ""Lead"" Engineer
    expect(csvStr).toContain('"Senior ""Lead"" Engineer"');

    // Values with newlines and quotes must be enclosed in quotes
    expect(csvStr).toContain('"First line\nSecond line with ""quotes"" and, commas."');
  });
});
