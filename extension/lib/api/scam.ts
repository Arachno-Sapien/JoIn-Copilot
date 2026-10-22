import { apiClient } from './client';
import { ScamCheckResponse, ScamCheckResponseSchema } from '../schemas/scam';

export async function checkJobScam(jobId: string): Promise<ScamCheckResponse> {
  return apiClient.post(`/jobs/${encodeURIComponent(jobId)}/scam-check`, {}, ScamCheckResponseSchema);
}
