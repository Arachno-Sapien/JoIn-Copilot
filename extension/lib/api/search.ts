import { type ZodSchema } from 'zod';
import { ApiClient } from './client';
import {
  SearchRequest,
  SearchRequestSchema,
  SearchResponse,
  SearchResponseSchema,
} from '../schemas/search';

export async function searchJobs(
  client: ApiClient,
  req: SearchRequest
): Promise<SearchResponse> {
  const validated = SearchRequestSchema.parse(req);
  return client.post<SearchResponse>(
    '/jobs/search',
    validated,
    SearchResponseSchema as unknown as ZodSchema<SearchResponse>
  );
}
