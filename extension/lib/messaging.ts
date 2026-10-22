import { z } from 'zod';

export const FormFieldSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  nearbyText: z.string().optional(),
  type: z.string().default('text').optional(),
  required: z.boolean().default(false).optional(),
  options: z.array(z.string()).optional(),
  manual: z.boolean().optional(),
});

export const FilledFieldSchema = z.object({
  name: z.string(),
  value: z.any(),
});

export const PageFormDetectedMessageSchema = z.object({
  type: z.literal('PAGE_FORM_DETECTED'),
  fields: z.array(FormFieldSchema),
  url: z.string(),
});

export const FillRequestMessageSchema = z.object({
  type: z.literal('FILL_REQUEST'),
  jobId: z.string(),
});

export const FillResultMessageSchema = z.object({
  type: z.literal('FILL_RESULT'),
  filled: z.array(FilledFieldSchema),
  skipped: z.array(FormFieldSchema).default([]),
});

export const ApplicationSubmittedMessageSchema = z.object({
  type: z.literal('APPLICATION_SUBMITTED'),
  jobId: z.string(),
  url: z.string(),
  answers: z.record(z.any()).optional(),
});

export const MessageSchema = z.discriminatedUnion('type', [
  PageFormDetectedMessageSchema,
  FillRequestMessageSchema,
  FillResultMessageSchema,
  ApplicationSubmittedMessageSchema,
]);

export type FormField = z.infer<typeof FormFieldSchema>;
export type FilledField = z.infer<typeof FilledFieldSchema>;
export type PageFormDetectedMessage = z.infer<typeof PageFormDetectedMessageSchema>;
export type FillRequestMessage = z.infer<typeof FillRequestMessageSchema>;
export type FillResultMessage = z.infer<typeof FillResultMessageSchema>;
export type ApplicationSubmittedMessage = z.infer<typeof ApplicationSubmittedMessageSchema>;
export type Message = z.infer<typeof MessageSchema>;
