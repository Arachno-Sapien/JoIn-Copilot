import { z } from 'zod';

export const JobSchema = z.object({
  id: z.string(),
  source: z.enum(['adzuna', 'greenhouse', 'lever', 'manual']),
  source_id: z.string(),
  url: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  remote: z.enum(['remote', 'onsite', 'hybrid', 'unknown']).default('unknown'),
  job_type: z.enum(['internship', 'full-time', 'contract', 'unknown']).default('unknown'),
  required_skills: z.array(z.string()).default([]),
  nice_to_have_skills: z.array(z.string()).default([]),
  experience_years_min: z.number().nullable().optional(),
  description: z.string(),
  posted_at: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  fetched_at: z.string(),
});

export type Job = z.infer<typeof JobSchema>;
