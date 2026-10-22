import { ApiClient, ApiError } from './client';
import { Profile, ProfileSchema } from '../schemas/profile';
import { getBackendUrl } from '../settings';
import { ErrorResponseSchema } from '../schemas/common';

export async function parseResume(
  client: ApiClient,
  file: File | Blob
): Promise<Profile> {
  const baseUrl = await getBackendUrl();
  const url = `${baseUrl.replace(/\/$/, '')}/profile/parse`;

  const formData = new FormData();
  const filename = (file as File).name || 'resume.pdf';
  formData.append('file', file, filename);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (err: any) {
    throw new ApiError(`Network request failed: ${err?.message || 'unknown error'}`);
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(`HTTP ${response.status}: Failed to parse JSON response`, response.status);
  }

  if (!response.ok) {
    const errorParsed = ErrorResponseSchema.safeParse(json);
    if (errorParsed.success) {
      throw new ApiError(errorParsed.data.error, response.status, errorParsed.data.detail);
    }
    const detailMsg = typeof json === 'object' ? (json?.detail || json?.error || JSON.stringify(json)) : String(json);
    throw new ApiError(`HTTP ${response.status}: ${detailMsg}`, response.status, detailMsg);
  }

  const result = ProfileSchema.safeParse(json);
  if (!result.success) {
    throw new ApiError(
      `Response schema validation failed: ${result.error.message}`,
      response.status
    );
  }

  return result.data;
}
