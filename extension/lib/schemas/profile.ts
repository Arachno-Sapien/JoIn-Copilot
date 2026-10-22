import { z } from 'zod';

export const BulletSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
});

export const EducationSchema = z.object({
  id: z.string().min(1),
  degree: z.string(),
  institution: z.string(),
  start: z.string(),
  end: z.string(),
  score: z.string().optional().nullable(),
});

export const ExperienceSchema = z.object({
  id: z.string().min(1),
  role: z.string(),
  org: z.string(),
  start: z.string(),
  end: z.string(),
  bullets: z.array(BulletSchema).default([]),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  bullets: z.array(BulletSchema).default([]),
});

export const SkillSchema = z.object({
  name: z.string(),
  level: z.enum(['familiar', 'working', 'strong', 'beginner', 'intermediate']),
});

export type SkillLevel = z.infer<typeof SkillSchema>['level'];

export const CertificationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  issuer: z.string(),
});

export const PreferencesSchema = z.object({
  locations: z.array(z.string()).default([]),
  remote: z.enum(['any', 'remote', 'onsite', 'hybrid']).default('any'),
  job_types: z.array(z.string()).default([]),
  min_stipend: z.number().nullable().optional(),
  avoid_keywords: z.array(z.string()).default([]),
  desired_roles: z.array(z.string()).optional(),
});

export const ProfileSchema = z.object({
  schema_version: z.number(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.record(z.string()).default({}),
  education: z.array(EducationSchema).default([]),
  experience: z.array(ExperienceSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  preferences: PreferencesSchema,
});

export type Bullet = z.infer<typeof BulletSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
