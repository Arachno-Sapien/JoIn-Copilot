import { type ZodSchema } from 'zod';
import { ApiClient } from './client';
import {
  DraftRequest,
  DraftRequestSchema,
  DraftResponse,
  DraftResponseSchema,
} from '../schemas/draft';

export async function draftAnswer(
  client: ApiClient,
  req: DraftRequest
): Promise<DraftResponse> {
  const validated = DraftRequestSchema.parse(req);
  return client.post<DraftResponse>(
    '/draft',
    validated,
    DraftResponseSchema as unknown as ZodSchema<DraftResponse>
  );
}
