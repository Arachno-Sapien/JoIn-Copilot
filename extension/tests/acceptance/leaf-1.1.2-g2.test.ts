import { describe, it, expect } from 'vitest';
import { ProfileSchema } from '../../lib/schemas/profile';
import { JobSchema } from '../../lib/schemas/job';
import { ApplicationSchema } from '../../lib/schemas/application';

describe('leaf-1.1.2:G2 Zod Schemas', () => {
  it('accepts valid profile sample', () => {
    const validProfile = {
      schema_version: 1,
      name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+1234567890',
      location: 'Bangalore, India',
      links: {
        linkedin: 'https://linkedin.com/in/alexdoe',
        github: 'https://github.com/alexdoe',
        portfolio: 'https://alexdoe.dev',
      },
      education: [
        {
          id: 'edu-1',
          degree: 'B.Tech CS',
          institution: 'Tech University',
          start: '2020-08',
          end: '2024-05',
          score: '8.8 CGPA',
        },
      ],
      experience: [
        {
          id: 'exp-1',
          role: 'SWE Intern',
          org: 'Acme Corp',
          start: '2023-06',
          end: '2023-12',
          bullets: [{ id: 'exp-1-b1', text: 'FastAPI microservices' }],
        },
      ],
      projects: [
        {
          id: 'proj-1',
          name: 'Job Copilot',
          bullets: [{ id: 'proj-1-b1', text: 'Chrome extension' }],
        },
      ],
      skills: [{ name: 'TypeScript', level: 'strong' }],
      certifications: [{ id: 'cert-1', name: 'AWS Associate', issuer: 'AWS' }],
      preferences: {
        locations: ['Bangalore', 'Remote'],
        remote: 'hybrid',
        job_types: ['full-time'],
        min_stipend: 50000,
        avoid_keywords: ['contractor'],
      },
    };

    const parsed = ProfileSchema.safeParse(validProfile);
    expect(parsed.success).toBe(true);
  });

  it('rejects bullet without id in profile', () => {
    const invalidProfile = {
      schema_version: 1,
      name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+1234567890',
      location: 'Bangalore',
      links: {},
      education: [],
      experience: [
        {
          id: 'exp-1',
          role: 'Intern',
          org: 'Acme',
          start: '2023-01',
          end: '2023-06',
          bullets: [{ text: 'Missing bullet id' }],
        },
      ],
      projects: [],
      skills: [],
      certifications: [],
      preferences: {
        locations: [],
        remote: 'any',
        job_types: ['full-time'],
        avoid_keywords: [],
      },
    };

    const parsed = ProfileSchema.safeParse(invalidProfile);
    expect(parsed.success).toBe(false);
  });

  it('rejects missing schema_version in profile', () => {
    const invalidProfile = {
      name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+1234567890',
      location: 'Bangalore',
      links: {},
      education: [],
      experience: [],
      projects: [],
      skills: [],
      certifications: [],
      preferences: {
        locations: [],
        remote: 'any',
        job_types: ['full-time'],
        avoid_keywords: [],
      },
    };

    const parsed = ProfileSchema.safeParse(invalidProfile);
    expect(parsed.success).toBe(false);
  });

  it('accepts valid job sample', () => {
    const validJob = {
      id: 'sha1-sample-job',
      source: 'greenhouse',
      source_id: 'gh-1234',
      url: 'https://boards.greenhouse.io/acme/jobs/1234',
      title: 'Full Stack Engineer',
      company: 'Acme',
      location: 'Bangalore',
      remote: 'hybrid',
      job_type: 'full-time',
      required_skills: ['React', 'TypeScript'],
      nice_to_have_skills: ['Tailwind'],
      experience_years_min: 2,
      description: 'Job description text',
      posted_at: '2026-10-01',
      deadline: null,
      fetched_at: '2026-10-18T10:00:00Z',
    };

    const parsed = JobSchema.safeParse(validJob);
    expect(parsed.success).toBe(true);
  });

  it('accepts valid application sample and rejects unknown status', () => {
    const validApp = {
      schema_version: 1,
      id: 'app-uuid-1',
      job_id: 'sha1-sample-job',
      job_snapshot: {
        title: 'Full Stack Engineer',
        company: 'Acme',
        url: 'https://boards.greenhouse.io/acme/jobs/1234',
        source: 'greenhouse',
      },
      applied_at: '2026-10-18T12:00:00Z',
      fit_score: 90,
      missing_skills: [],
      resume_version: 'v1.0',
      answers: [],
      status: 'applied',
      status_history: [{ status: 'applied', at: '2026-10-18T12:00:00Z', source: 'user' }],
      notes: 'Applied through Greenhouse',
    };

    expect(ApplicationSchema.safeParse(validApp).success).toBe(true);

    const invalidApp = {
      ...validApp,
      status: 'in_progress', // invalid status
    };
    expect(ApplicationSchema.safeParse(invalidApp).success).toBe(false);
  });
});
