import { z } from 'zod';
import { ProfileSchema } from './profile';

export const ParseResumeResponseSchema = ProfileSchema;
export type ParseResumeResponse = z.infer<typeof ParseResumeResponseSchema>;
