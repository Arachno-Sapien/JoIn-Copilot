import { describe, it, expect } from 'vitest';
import { mapFieldRuleBased, mapAllFields } from '../../../lib/field-mapper';
import { Profile } from '../../../lib/schemas/profile';

describe('field-mapper Unit Tests', () => {
  const sampleProfile: Profile = {
    schema_version: 1,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1-555-0100',
    location: 'San Francisco, CA',
    links: {
      linkedin: 'https://linkedin.com/in/janedoe',
      github: 'https://github.com/janedoe',
      portfolio: 'https://janedoe.dev',
    },
    education: [
      {
        id: 'edu-1',
        degree: 'B.S. Computer Science',
        institution: 'Stanford University',
        start: '2018-09',
        end: '2022-06',
      },
    ],
    experience: [
      {
        id: 'exp-1',
        role: 'Software Engineer',
        org: 'TechCorp',
        start: '2022-07',
        end: 'present',
        bullets: [{ id: 'b1', text: 'Built cloud APIs' }],
      },
    ],
    projects: [],
    skills: [{ name: 'TypeScript', level: 'strong' }],
    certifications: [],
    preferences: {
      locations: ['San Francisco'],
      remote: 'hybrid',
      job_types: ['full-time'],
      min_stipend: 0,
      avoid_keywords: [],
    },
  };

  it('maps standard fields by rule', () => {
    expect(mapFieldRuleBased({ name: 'first_name' }, sampleProfile)).toBe('Jane');
    expect(mapFieldRuleBased({ name: 'last_name' }, sampleProfile)).toBe('Doe');
    expect(mapFieldRuleBased({ name: 'full_name' }, sampleProfile)).toBe('Jane Doe');
    expect(mapFieldRuleBased({ name: 'email', type: 'email' }, sampleProfile)).toBe('jane@example.com');
    expect(mapFieldRuleBased({ name: 'phone', type: 'tel' }, sampleProfile)).toBe('+1-555-0100');
    expect(mapFieldRuleBased({ name: 'linkedin' }, sampleProfile)).toBe('https://linkedin.com/in/janedoe');
    expect(mapFieldRuleBased({ name: 'github' }, sampleProfile)).toBe('https://github.com/janedoe');
    expect(mapFieldRuleBased({ name: 'org', label: 'Current Company' }, sampleProfile)).toBe('TechCorp');
    expect(mapFieldRuleBased({ name: 'school', label: 'University' }, sampleProfile)).toBe('Stanford University');
    expect(mapFieldRuleBased({ name: 'grad_year', label: 'Graduation Year' }, sampleProfile)).toBe('2022');
  });

  it('maps all fields with backend and draft fallbacks', () => {
    const fields = [
      { name: 'first_name' },
      { name: 'email', type: 'email' },
      { name: 'custom_salary' },
      { name: 'essay_question' },
    ];

    const mapped = mapAllFields(fields, sampleProfile, {
      mappedFromBackend: { custom_salary: '$120,000' },
      drafts: { essay_question: 'Passionate about distributed systems.' },
    });

    expect(mapped.first_name).toBe('Jane');
    expect(mapped.email).toBe('jane@example.com');
    expect(mapped.custom_salary).toBe('$120,000');
    expect(mapped.essay_question).toBe('Passionate about distributed systems.');
  });
});
