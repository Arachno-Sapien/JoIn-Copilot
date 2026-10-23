import { ApiClient, readBackendResult } from './client';
import { Profile, ProfileSchema } from '../schemas/profile';
import { requestBackend } from './transport';

export async function parseResume(_client: ApiClient, file: File | Blob): Promise<Profile> {
  const name = (file as File).name || 'resume.pdf';
  const blob = file.type ? file : new Blob([file], { type: 'application/pdf' });
  const result = await requestBackend({ endpoint: 'profile/parse', method: 'POST', file: { name, blob } });
  return readBackendResult(result, ProfileSchema);
}
