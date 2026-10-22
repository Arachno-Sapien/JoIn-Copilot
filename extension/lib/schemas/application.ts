import { z } from 'zod';

export const JobSnapshotSchema = z.object({
  title: z.string(),
  company: z.string(),
  url: z.string(),
  source: z.string(),
});

export const AnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  flags: z.array(z.string()).default([]),
});

export const ApplicationStatusSchema = z.enum([
  'applied',
  'viewed',
  'assessment',
  'interview',
  'offer',
  'rejected',
  'no_response',
  'withdrawn',
]);

export const StatusHistoryEntrySchema = z.object({
  status: z.string(),
  at: z.string(),
  source: z.enum(['user', 'gmail', 'portal', 'auto']).default('user'),
});

export const ApplicationSchema = z.object({
  schema_version: z.number().default(1),
  id: z.string(),
  job_id: z.string(),
  job_snapshot: JobSnapshotSchema,
  applied_at: z.string(),
  fit_score: z.number().default(0),
  missing_skills: z.array(z.string()).default([]),
  resume_version: z.string(),
  answers: z.array(AnswerSchema).default([]),
  status: ApplicationStatusSchema,
  status_history: z.array(StatusHistoryEntrySchema).default([]),
  notes: z.string().default(''),
});

export type JobSnapshot = z.infer<typeof JobSnapshotSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntrySchema>;
export type Application = z.infer<typeof ApplicationSchema>;
