import { z, type ZodSchema } from 'zod';
import { getBackendUrl } from '../settings';
import { ErrorResponseSchema } from '../schemas/common';

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

export class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit,
    schema: ZodSchema<T>
  ): Promise<T> {
    const baseUrl = await getBackendUrl();
    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (err: any) {
      throw new ApiError(`Network request failed: ${err?.message || 'unknown error'}`);
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      if (!response.ok) {
        throw new ApiError(`HTTP ${response.status}: ${response.statusText}`, response.status);
      }
      throw new ApiError('Failed to parse response JSON', response.status);
    }

    if (!response.ok) {
      const parsedError = ErrorResponseSchema.safeParse(json);
      if (parsedError.success) {
        throw new ApiError(parsedError.data.error, response.status, parsedError.data.detail);
      }
      throw new ApiError(`HTTP ${response.status}: ${JSON.stringify(json)}`, response.status);
    }

    const validation = schema.safeParse(json);
    if (!validation.success) {
      throw new ApiError(
        `Response schema validation failed: ${validation.error.message}`,
        response.status
      );
    }

    return validation.data;
  }

  async get<T = any>(endpoint: string, schema: any): Promise<T> {
    return this.request(
      endpoint,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      schema
    );
  }

  async post<T = any>(endpoint: string, data: any, schema: any): Promise<T> {
    return this.request(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(data),
      },
      schema
    );
  }
}

export const apiClient = new ApiClient();
