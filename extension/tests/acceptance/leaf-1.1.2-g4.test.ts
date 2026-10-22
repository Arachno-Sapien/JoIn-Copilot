import { describe, it, expect } from 'vitest';
import { MessageSchema } from '../../lib/messaging';

describe('leaf-1.1.2:G4 Messaging Discriminated Union', () => {
  it('validates PAGE_FORM_DETECTED message', () => {
    const msg = {
      type: 'PAGE_FORM_DETECTED',
      fields: [{ name: 'first_name', label: 'First Name', type: 'text' }],
      url: 'https://boards.greenhouse.io/test',
    };
    expect(MessageSchema.safeParse(msg).success).toBe(true);
  });

  it('validates FILL_REQUEST message', () => {
    const msg = {
      type: 'FILL_REQUEST',
      jobId: 'job-123',
    };
    expect(MessageSchema.safeParse(msg).success).toBe(true);
  });

  it('validates FILL_RESULT message', () => {
    const msg = {
      type: 'FILL_RESULT',
      filled: [{ name: 'first_name', value: 'Alex' }],
      skipped: [],
    };
    expect(MessageSchema.safeParse(msg).success).toBe(true);
  });

  it('validates APPLICATION_SUBMITTED message', () => {
    const msg = {
      type: 'APPLICATION_SUBMITTED',
      jobId: 'job-123',
      url: 'https://boards.greenhouse.io/test/thanks',
    };
    expect(MessageSchema.safeParse(msg).success).toBe(true);
  });

  it('rejects unknown message type', () => {
    const msg = {
      type: 'UNKNOWN_EVENT',
      data: 123,
    };
    expect(MessageSchema.safeParse(msg).success).toBe(false);
  });

  it('rejects malformed payload missing required field', () => {
    const msg = {
      type: 'FILL_REQUEST',
      // missing jobId
    };
    expect(MessageSchema.safeParse(msg).success).toBe(false);
  });
});
