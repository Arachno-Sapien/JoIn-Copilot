// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ResumeUpload } from '../../components/sidepanel/ResumeUpload';
import { db } from '../../lib/db';
import * as profileApi from '../../lib/api/profile';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('leaf-1.3.3:G1 Resume Upload and Profile Parse', () => {
  beforeEach(async () => {
    await db.profile.clear();
    await db.resumes.clear();
  });

  it('uploading a PDF calls /profile/parse, stores profile and resume blob, and shows parsed profile', async () => {
    const fakeParsedProfile = {
      schema_version: 1,
      name: 'Taylor Swift',
      email: 'taylor@example.com',
      phone: '+1-555-1313',
      location: 'Nashville, TN',
      links: { linkedin: 'https://linkedin.com/in/taylor' },
      education: [
        { id: 'edu-1', degree: 'B.A.', institution: 'State University', start: '2016', end: '2020' },
      ],
      experience: [
        { id: 'exp-1', role: 'Staff Engineer', org: 'Republic Records', start: '2020', end: 'present', bullets: [{ id: 'b1', text: 'Scaled audio APIs' }] },
      ],
      projects: [],
      skills: [{ name: 'Music Production', level: 'expert' }],
      certifications: [],
      preferences: {
        locations: ['Nashville'],
        remote: 'hybrid',
        job_types: ['full-time'],
        min_stipend: 0,
        avoid_keywords: [],
      },
    };

    // Mock parseResume
    const parseSpy = vi.spyOn(profileApi, 'parseResume').mockResolvedValue(fakeParsedProfile as any);

    render(<ResumeUpload />);

    const fileInput = screen.getByLabelText(/upload resume/i) as HTMLInputElement;
    const testFile = new File(['%PDF-1.4 mock content'], 'taylor_resume.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(parseSpy).toHaveBeenCalledTimes(1);
    });

    // Check UI displays parsed profile
    await waitFor(() => {
      expect(screen.getByText('Taylor Swift')).toBeDefined();
      expect(screen.getByText('taylor@example.com')).toBeDefined();
      expect(screen.getByText(/Republic Records/i)).toBeDefined();
    });

    // Check IndexedDB storage
    const storedProfile = await db.profile.get('main');
    expect(storedProfile).toBeDefined();
    expect(storedProfile?.name).toBe('Taylor Swift');

    const storedResumes = await db.resumes.toArray();
    expect(storedResumes.length).toBe(1);
    expect(storedResumes[0].filename).toBe('taylor_resume.pdf');
  });
});
