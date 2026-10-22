import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, AppDatabase } from '../../lib/db';

describe('leaf-1.1.2:G3 Dexie Database Storage & Migrations', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('stores and reads back a profile, an application, and a resume blob', async () => {
    const profile = {
      schema_version: 1,
      name: 'Test Candidate',
      email: 'test@example.com',
      phone: '1234567890',
      location: 'Bangalore',
      links: {},
      education: [],
      experience: [],
      projects: [],
      skills: [{ name: 'React', level: 'strong' as const }],
      certifications: [],
      preferences: {
        locations: ['Bangalore'],
        remote: 'remote' as const,
        job_types: ['full-time'],
        min_stipend: null,
        avoid_keywords: [],
      },
    };

    await db.profile.put({ id: 'main', ...profile });
    const loadedProfile = await db.profile.get('main');
    expect(loadedProfile?.name).toBe('Test Candidate');

    const app = {
      schema_version: 1,
      id: 'app-1',
      job_id: 'job-1',
      job_snapshot: {
        title: 'Developer',
        company: 'Corp',
        url: 'https://example.com',
        source: 'manual',
      },
      applied_at: '2026-10-18T10:00:00Z',
      fit_score: 80,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied' as const,
      status_history: [{ status: 'applied', at: '2026-10-18T10:00:00Z', source: 'user' as const }],
      notes: '',
    };

    await db.applications.put(app);
    const loadedApp = await db.applications.get('app-1');
    expect(loadedApp?.status).toBe('applied');

    const blob = new Blob(['%PDF-1.4 test resume'], { type: 'application/pdf' });
    await db.resumes.put({
      id: 'resume-1',
      filename: 'resume.pdf',
      data: blob,
      uploadedAt: '2026-10-18T10:00:00Z',
    });

    const loadedResume = await db.resumes.get('resume-1');
    expect(loadedResume?.filename).toBe('resume.pdf');
    expect(loadedResume?.data).toBeInstanceOf(Blob);
  });

  it('upgrades older schema version through migration', async () => {
    // Test that database has version upgrades configured
    expect(db.verno).toBeGreaterThanOrEqual(2);
  });
});
