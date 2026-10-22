import { z } from 'zod';
import { ProfileSchema } from './profile';

export const FormFieldInputSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string().default('text'),
  options: z.array(z.string()).nullable().optional(),
});

export type FormFieldInput = z.infer<typeof FormFieldInputSchema>;

export const FieldMappingSchema = z.object({
  field_id: z.string(),
  field_name: z.string(),
  action: z.enum(['fill', 'open_question', 'skip']).default('fill'),
  profile_path: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  is_open_question: z.boolean().default(false),
  is_flagged: z.boolean().default(false),
  flag_reason: z.string().nullable().optional(),
});

export type FieldMapping = z.infer<typeof FieldMappingSchema>;

export const MapFieldsRequestSchema = z.object({
  profile: ProfileSchema,
  fields: z.array(FormFieldInputSchema).default([]),
});

export type MapFieldsRequest = z.infer<typeof MapFieldsRequestSchema>;

export const MapFieldsResponseSchema = z.object({
  mappings: z.array(FieldMappingSchema).default([]),
});

export type MapFieldsResponse = z.infer<typeof MapFieldsResponseSchema>;
