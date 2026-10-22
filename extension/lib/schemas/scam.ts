import { z } from 'zod';

export const ScamRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type ScamRiskLevel = z.infer<typeof ScamRiskLevelSchema>;

export const ScamCheckResponseSchema = z.object({
  job_id: z.string(),
  risk_level: ScamRiskLevelSchema,
  reasons: z.array(z.string()).default([]),
  rule_signals: z.array(z.string()).default([]),
  llm_flags: z.array(z.string()).default([]),
  injection_warning: z.string().nullable().optional(),
});
export type ScamCheckResponse = z.infer<typeof ScamCheckResponseSchema>;
