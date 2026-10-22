import { z } from 'zod';

export const EmailClassificationSchema = z.enum([
  'acknowledgement',
  'assessment',
  'interview',
  'rejection',
  'offer',
  'other',
]);
export type EmailClassification = z.infer<typeof EmailClassificationSchema>;

export const CandidateApplicationSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
});
export type CandidateApplication = z.infer<typeof CandidateApplicationSchema>;

export const EmailInputSchema = z.object({
  sender: z.string(),
  subject: z.string(),
  date: z.string(),
  body: z.string(),
});
export type EmailInput = z.infer<typeof EmailInputSchema>;

export const EmailClassifyRequestSchema = z.object({
  email: EmailInputSchema,
  candidates: z.array(CandidateApplicationSchema),
});
export type EmailClassifyRequest = z.infer<typeof EmailClassifyRequestSchema>;

export const EmailClassifyResponseSchema = z.object({
  matched_application_id: z.string().nullable().optional(),
  classification: EmailClassificationSchema,
  confidence: z.number().min(0.0).max(1.0),
  reasoning: z.string().nullable().optional(),
});
export type EmailClassifyResponse = z.infer<typeof EmailClassifyResponseSchema>;

export interface PendingConfirmation {
  id: string;
  applicationId: string;
  company: string;
  role: string;
  detectedStatus: EmailClassification;
  confidence: number;
  subject: string;
  date: string;
}
