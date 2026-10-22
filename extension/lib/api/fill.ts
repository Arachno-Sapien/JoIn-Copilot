import { type ZodSchema } from 'zod';
import { ApiClient } from './client';
import {
  MapFieldsRequest,
  MapFieldsRequestSchema,
  MapFieldsResponse,
  MapFieldsResponseSchema,
} from '../schemas/fill';

export async function mapFields(
  client: ApiClient,
  req: MapFieldsRequest
): Promise<MapFieldsResponse> {
  const validated = MapFieldsRequestSchema.parse(req);
  return client.post<MapFieldsResponse>(
    '/fill/map-fields',
    validated,
    MapFieldsResponseSchema as unknown as ZodSchema<MapFieldsResponse>
  );
}
