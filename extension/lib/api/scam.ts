import { apiClient } from './client';
import { Job } from '../schemas/job';
import { ScamCheckResponse, ScamCheckResponseSchema } from '../schemas/scam';

export async function checkJobScam(jobOrId: Job | string): Promise<ScamCheckResponse> {
  const isJob = typeof jobOrId === 'object' && jobOrId !== null;
  const jobId = isJob ? jobOrId.id : jobOrId;
  const body = isJob ? { job: jobOrId } : {};
  return apiClient.post(`/jobs/${encodeURIComponent(jobId)}/scam-check`, body, ScamCheckResponseSchema);
}
