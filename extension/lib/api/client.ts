import { type z, type ZodSchema, type ZodTypeAny } from 'zod';
import { ErrorResponseSchema } from '../schemas/common';
import { requestBackend, type BackendRequest, type BackendResult } from './transport';

export class ApiError extends Error {
  status?: number;
  detail?: string | null;

  constructor(message: string, status?: number, detail?: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** Turn a backend reply into validated data or an ApiError ({error, detail} bodies included). */
export function readBackendResult<S extends ZodTypeAny>(result: BackendResult, schema: S): z.output<S> {
  if (result.networkError !== undefined) {
    throw new ApiError(`Network request failed: ${result.networkError}`);
  }
  const json: any = result.body;
  if (json === null) {
    if (!result.ok) throw new ApiError(`HTTP ${result.status}`, result.status);
    throw new ApiError('Failed to parse response JSON', result.status);
  }
  if (!result.ok) {
    const parsedError = ErrorResponseSchema.safeParse(json);
    if (parsedError.success) {
      throw new ApiError(parsedError.data.error, result.status, parsedError.data.detail);
    }
    throw new ApiError(`HTTP ${result.status}: ${JSON.stringify(json)}`, result.status);
  }
  const validation = schema.safeParse(json);
  if (!validation.success) {
    throw new ApiError(`Response schema validation failed: ${validation.error.message}`, result.status);
  }
  return validation.data;
}

export class ApiClient {
  private async request<T>(request: BackendRequest, schema: ZodSchema<T>): Promise<T> {
    // requestBackend calls the backend from this extension context and adds the BharatCode key.
    return readBackendResult(await requestBackend(request), schema);
  }

  async get<T = any>(endpoint: string, schema: any): Promise<T> {
    return this.request({ endpoint, method: 'GET' }, schema);
  }

  async post<T = any>(endpoint: string, data: any, schema: any): Promise<T> {
    return this.request({ endpoint, method: 'POST', json: data }, schema);
  }
}

export const apiClient = new ApiClient();
