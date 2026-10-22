import { ApiClient, readBackendResult } from './client';
import { Profile, ProfileSchema } from '../schemas/profile';
import { blobToBase64, requestBackend } from './transport';

export async function parseResume(_client: ApiClient, file: File | Blob): Promise<Profile> {
  const name = (file as File).name || 'resume.pdf';
  const result = await requestBackend({
    endpoint: 'profile/parse',
    method: 'POST',
    file: { name, type: file.type || 'application/pdf', base64: await blobToBase64(file) },
  });
  return readBackendResult(result, ProfileSchema);
}
