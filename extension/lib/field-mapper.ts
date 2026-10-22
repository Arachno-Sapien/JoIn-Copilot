import { FormField } from './messaging';
import { Profile } from './schemas/profile';

export type FormFieldInput = Partial<FormField> & {
  name: string;
};

/**
 * Maps known form fields using strict local heuristics against the user profile.
 */
export function mapFieldRuleBased(field: FormFieldInput, profile: Profile): string | null {
  const name = (field.name || '').toLowerCase();
  const label = (field.label || '').toLowerCase();
  const placeholder = (field.placeholder || '').toLowerCase();
  const id = (field.id || '').toLowerCase();

  const combined = `${name} ${label} ${placeholder} ${id}`;

  // First name
  if (combined.includes('first_name') || combined.includes('firstname') || combined.includes('first name') || combined.includes('given name')) {
    const parts = profile.name.trim().split(/\s+/);
    return parts[0] || profile.name;
  }

  // Last name
  if (combined.includes('last_name') || combined.includes('lastname') || combined.includes('last name') || combined.includes('family name') || combined.includes('surname')) {
    const parts = profile.name.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  // Full name
  if (
    combined.includes('full_name') ||
    combined.includes('fullname') ||
    combined.includes('full name') ||
    name === 'name' ||
    label === 'name' ||
    placeholder === 'full name'
  ) {
    return profile.name;
  }

  // Email
  if (field.type === 'email' || combined.includes('email') || combined.includes('e-mail')) {
    return profile.email;
  }

  // Phone
  if (field.type === 'tel' || combined.includes('phone') || combined.includes('mobile') || combined.includes('telephone')) {
    return profile.phone;
  }

  // LinkedIn
  if (combined.includes('linkedin')) {
    return profile.links.linkedin || null;
  }

  // GitHub
  if (combined.includes('github')) {
    return profile.links.github || null;
  }

  // Portfolio / Website
  if (combined.includes('portfolio') || combined.includes('website') || combined.includes('personal link') || combined.includes('blog')) {
    return profile.links.portfolio || null;
  }

  // Location / City
  if (combined.includes('city') || combined.includes('location') || combined.includes('address')) {
    return profile.location;
  }

  // Current company
  if (combined.includes('current company') || combined.includes('employer') || name === 'org') {
    if (profile.experience && profile.experience.length > 0) {
      return profile.experience[0].org;
    }
  }

  // Degree / School
  if (combined.includes('university') || combined.includes('school') || combined.includes('institution')) {
    if (profile.education && profile.education.length > 0) {
      return profile.education[0].institution;
    }
  }
  if (combined.includes('degree')) {
    if (profile.education && profile.education.length > 0) {
      return profile.education[0].degree;
    }
  }

  // Graduation year
  if (combined.includes('graduation') || combined.includes('grad year')) {
    if (profile.education && profile.education.length > 0) {
      const end = profile.education[0].end;
      const match = end.match(/\b(20\d\d)\b/);
      if (match) return match[1];
    }
  }

  return null;
}

/**
 * Maps all fields combining rule-based mapping, backend field-mapping, and question drafts.
 */
export function mapAllFields(
  fields: FormFieldInput[],
  profile: Profile,
  options?: {
    resumeFile?: File;
    mappedFromBackend?: Record<string, string>;
    drafts?: Record<string, string>;
  }
): Record<string, string | File> {
  const result: Record<string, string | File> = {};

  for (const field of fields) {
    const key = field.name || field.id || '';
    if (!key) continue;

    if (field.type === 'file' || key.toLowerCase().includes('resume') || (field.label || '').toLowerCase().includes('resume')) {
      if (options?.resumeFile) {
        result[key] = options.resumeFile;
      }
      continue;
    }

    // 1. Try rule-based mapping first
    const ruleValue = mapFieldRuleBased(field, profile);
    if (ruleValue !== null) {
      result[key] = ruleValue;
      continue;
    }

    // 2. Try backend mapped values
    if (options?.mappedFromBackend && key in options.mappedFromBackend) {
      result[key] = options.mappedFromBackend[key];
      continue;
    }

    // 3. Try draft answers
    if (options?.drafts && key in options.drafts) {
      result[key] = options.drafts[key];
      continue;
    }
  }

  return result;
}
