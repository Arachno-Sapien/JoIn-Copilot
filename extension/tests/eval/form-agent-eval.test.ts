// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mapFieldRuleBased } from '../../lib/field-mapper';
import { FormField } from '../../lib/messaging';
import { Profile } from '../../lib/schemas/profile';

describe('Form Agent Evaluation Suite', () => {
  it('evaluates rule-based field mapping accuracy on mock portal form fields', () => {
    const profile: Profile = {
      schema_version: 1,
      name: 'Alex Developer',
      email: 'alex@example.com',
      phone: '+1-555-0199',
      location: 'Remote',
      links: { linkedin: 'https://linkedin.com/in/alexdev' },
      education: [],
      experience: [],
      projects: [],
      skills: [
        { name: 'TypeScript', level: 'strong' },
        { name: 'React', level: 'strong' },
      ],
      certifications: [],
      preferences: {
        desired_roles: ['Software Engineer'],
        locations: ['Remote'],
        remote: 'remote',
        job_types: ['full-time'],
        avoid_keywords: [],
      },
    };

    const mockPortalFields: FormField[] = [
      { id: 'first_name', name: 'first_name', label: 'First Name', type: 'text', required: true },
      { id: 'last_name', name: 'last_name', label: 'Last Name', type: 'text', required: true },
      { id: 'email', name: 'email', label: 'Email Address', type: 'email', required: true },
      { id: 'phone', name: 'phone', label: 'Phone Number', type: 'tel', required: false },
      { id: 'linkedin', name: 'linkedin', label: 'LinkedIn Profile URL', type: 'text', required: false },
    ];

    const mapped = mockPortalFields.map(f => ({
      field_id: f.id,
      value: mapFieldRuleBased(f, profile),
    }));

    expect(mapped.find(m => m.field_id === 'first_name')?.value).toBe('Alex');
    expect(mapped.find(m => m.field_id === 'last_name')?.value).toBe('Developer');
    expect(mapped.find(m => m.field_id === 'email')?.value).toBe('alex@example.com');
    expect(mapped.find(m => m.field_id === 'phone')?.value).toBe('+1-555-0199');
    expect(mapped.find(m => m.field_id === 'linkedin')?.value).toBe('https://linkedin.com/in/alexdev');
  });
});
