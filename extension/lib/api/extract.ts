import { z, type ZodSchema } from 'zod';
import { ApiClient } from './client';
import { ExtractJobRequest, ExtractJobRequestSchema } from '../schemas/extract';
import { Job, JobSchema } from '../schemas/job';

export async function extractJob(
  client: ApiClient,
  req: ExtractJobRequest
): Promise<Job> {
  const validated = ExtractJobRequestSchema.parse(req);
  return client.post<Job>('/jobs/extract', validated, JobSchema as unknown as ZodSchema<Job>);
}

