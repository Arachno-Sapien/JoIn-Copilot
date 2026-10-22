// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProfileEditor } from '../../components/sidepanel/ProfileEditor';
import { db } from '../../lib/db';
import { Profile } from '../../lib/schemas/profile';

afterEach(() => {
  cleanup();
});

describe('leaf-1.3.3:G2 Inline Profile Editing and Persistence', () => {
  const initialProfile: Profile = {
    schema_version: 1,
    name: 'Jordan Smith',
    email: 'jordan@example.com',
    phone: '+1-555-4321',
    location: 'Chicago, IL',
    links: { linkedin: 'https://linkedin.com/in/jordansmith' },
    education: [{ id: 'edu-1', degree: 'B.S. CS', institution: 'UIUC', start: '2019', end: '2023' }],
    experience: [{ id: 'exp-1', role: 'Software Engineer', org: 'Orbit', start: '2023', end: 'present', bullets: [{ id: 'b1', text: 'Backend services' }] }],
    projects: [],
    skills: [
      { name: 'Python', level: 'intermediate' },
      { name: 'TypeScript', level: 'beginner' },
    ],
    certifications: [],
    preferences: { locations: ['Chicago'], remote: 'hybrid', job_types: ['full-time'], min_stipend: 0, avoid_keywords: [] },
  };

  beforeEach(async () => {
    await db.profile.clear();
    await db.profile.put({ ...initialProfile, id: 'main' });
  });

  it('allows editing name, email, location and skill level inline and persists to IndexedDB', async () => {
    render(<ProfileEditor initialProfile={initialProfile} />);

    // Edit Name
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Jordan W. Smith' } });

    // Edit Location
    const locationInput = screen.getByLabelText(/location/i) as HTMLInputElement;
    fireEvent.change(locationInput, { target: { value: 'New York, NY' } });

    // Edit Skill Level for Python from 'intermediate' to 'expert'
    const pythonLevelSelect = screen.getByLabelText(/python level/i) as HTMLSelectElement;
    fireEvent.change(pythonLevelSelect, { target: { value: 'expert' } });

    // Save changes
    const saveButton = screen.getByRole('button', { name: /save profile/i });
    fireEvent.click(saveButton);

    await waitFor(async () => {
      const stored = await db.profile.get('main');
      expect(stored?.name).toBe('Jordan W. Smith');
      expect(stored?.location).toBe('New York, NY');
      const pySkill = stored?.skills.find((s) => s.name === 'Python');
      expect(pySkill?.level).toBe('expert');
    });
  });
});
