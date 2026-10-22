import { z } from 'zod';
import { JobSchema } from './job';
import { ProfileSchema } from './profile';

export const RerankFactsSchema = z.object({
  matched_required: z.array(z.string()).default([]),
  missing_required: z.array(z.string()).default([]),
  matched_nice_to_have: z.array(z.string()).default([]),
  experience_gap: z.string().default(''),
  summary: z.string().default(''),
});

export type RerankFacts = z.infer<typeof RerankFactsSchema>;

export const RankedJobSchema = z.object({
  job: JobSchema,
  fit_score: z.number(),
  fit_reasons: z.array(z.string()).default([]),
  missing_skills: z.array(z.string()).default([]),
  facts: RerankFactsSchema.optional(),
});

export type RankedJob = z.infer<typeof RankedJobSchema>;

export const SearchRequestSchema = z.object({
  profile: ProfileSchema,
  jobs: z.array(JobSchema).optional(),
  limit: z.number().optional(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(RankedJobSchema).default([]),
  total_evaluated: z.number().default(0),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export type ScoredJob = RankedJob;
export const ScoredJobSchema = RankedJobSchema;
