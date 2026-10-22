import { apiClient } from './client';
import {
  EmailClassifyRequest,
  EmailClassifyResponse,
  EmailClassifyResponseSchema,
  CandidateApplication,
  EmailInput,
} from '../schemas/email';

export async function classifyEmail(
  email: EmailInput,
  candidates: CandidateApplication[]
): Promise<EmailClassifyResponse> {
  const payload: EmailClassifyRequest = { email, candidates };
  return apiClient.post('/email/classify', payload, EmailClassifyResponseSchema);
}
