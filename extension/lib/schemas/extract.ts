import { z } from 'zod';

export const ExtractJobRequestSchema = z.object({
  text: z.string(),
  url: z.string(),
});

export type ExtractJobRequest = z.infer<typeof ExtractJobRequestSchema>;
