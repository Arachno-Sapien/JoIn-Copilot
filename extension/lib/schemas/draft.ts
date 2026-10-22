import { z } from 'zod';
import { JobSchema } from './job';
import { ProfileSchema } from './profile';

export const ClaimWithVerdictSchema = z.object({
  claim: z.string(),
  verdict: z.enum(['supported', 'partly_supported', 'unsupported']).optional(),
  judgment: z.enum(['supported', 'partly_supported', 'unsupported']).optional(),
  reason: z.string().default('').optional(),
  cited_ids: z.array(z.string()).default([]).optional(),
  is_flagged: z.boolean().default(false).optional(),
});

export type ClaimWithVerdict = z.infer<typeof ClaimWithVerdictSchema>;

export const FlaggedSpanSchema = z.object({
  text: z.string(),
  start: z.number().nullable().optional(),
  end: z.number().nullable().optional(),
  reason: z.string(),
});

export type FlaggedSpan = z.infer<typeof FlaggedSpanSchema>;

export const DraftRequestSchema = z.object({
  job: JobSchema,
  question: z.string(),
  profile: ProfileSchema,
});

export type DraftRequest = z.infer<typeof DraftRequestSchema>;

export const DraftResponseSchema = z.object({
  draft: z.string(),
  claims: z.array(ClaimWithVerdictSchema).default([]),
  flagged_spans: z.array(FlaggedSpanSchema).default([]),
  rewrite: z.string().nullable().optional(),
  rewritten_draft: z.string().nullable().optional(),
  verdict: z.string().nullable().optional(),
  cited_bullet_ids: z.array(z.string()).optional(),
});

export type DraftResponse = z.infer<typeof DraftResponseSchema>;
