// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../lib/db';
import { deleteAllUserData } from '../../lib/export';

describe('leaf-1.4.2:G5 Delete all data empties IndexedDB and chrome.storage.local', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(async () => {
    mockStorage = { user_setting_1: 'val1', backend_url: 'http://localhost:8000' };

    (globalThis as any).chrome = {
      storage: {
        local: {
          clear: vi.fn(async () => {
            mockStorage = {};
          }),
          get: vi.fn(async () => mockStorage),
        },
      },
    };

    await db.profile.put({
      id: 'main',
      schema_version: 1,
      name: 'User',
      email: 'user@example.com',
      phone: '',
      location: '',
      links: {},
      education: [],
      experience: [],
      projects: [],
      skills: [],
      certifications: [],
      preferences: {
        desired_roles: [],
        locations: [],
        remote_only: false,
        minimum_salary: 0,
        sponsorship_required: false,
      },
    });

    await db.applications.put({
      schema_version: 1,
      id: 'app-del-1',
      job_id: 'job-1',
      job_snapshot: { title: 'Engineer', company: 'Corp', url: '', source: 'greenhouse' },
      applied_at: '2026-10-01T00:00:00Z',
      fit_score: 50,
      missing_skills: [],
      resume_version: 'v1',
      answers: [],
      status: 'applied',
      status_history: [],
      notes: '',
    });

    await db.resumes.put({
      id: 'res-del-1',
      filename: 'resume.pdf',
      data: new Blob(['test'], { type: 'application/pdf' }),
      uploadedAt: '2026-10-01T00:00:00Z',
    });
  });

  it('completely empties all IndexedDB tables and chrome.storage.local', async () => {
    expect(await db.profile.count()).toBe(1);
    expect(await db.applications.count()).toBe(1);
    expect(await db.resumes.count()).toBe(1);

    await deleteAllUserData();

    expect(await db.profile.count()).toBe(0);
    expect(await db.applications.count()).toBe(0);
    expect(await db.resumes.count()).toBe(0);

    expect(chrome.storage.local.clear).toHaveBeenCalled();
    expect(Object.keys(mockStorage).length).toBe(0);
  });
});
