import { describe, it, expect, vi } from 'vitest';
import { ensureAlarm } from '../../../entrypoints/background/sidepanel';
import { extractBody, syncGmailWithMessages } from '../../../lib/gmail';

vi.mock('../../../lib/db', () => ({
  db: { applications: { toArray: async () => [], get: async () => undefined } },
}));

const b64 = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_');

describe('background alarms', () => {
  it('keeps an existing alarm, so waking the worker does not restart its timer', async () => {
    const create = vi.fn();
    (globalThis as any).chrome = { alarms: { get: vi.fn(async () => ({ name: 'gmail_sync' })), create } };
    await ensureAlarm('gmail_sync', 180);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a missing alarm', async () => {
    const create = vi.fn();
    (globalThis as any).chrome = { alarms: { get: vi.fn(async () => undefined), create } };
    await ensureAlarm('gmail_sync', 180);
    expect(create).toHaveBeenCalledWith('gmail_sync', { periodInMinutes: 180 });
  });
});

describe('gmail', () => {
  it('reads the text of an email nested inside multipart parts', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/html', body: { data: b64('<p>Interview</p>') } },
            { mimeType: 'text/plain', body: { data: b64('Interview on Monday') } },
          ],
        },
      ],
    };
    expect(extractBody(payload)).toBe('Interview on Monday');
  });

  it('does not move the sync time forward when every email failed to classify', async () => {
    const set = vi.fn();
    (globalThis as any).chrome = { storage: { local: { set } } };
    const email = { sender: 'a@example.test', subject: 's', date: '2026-01-01T00:00:00Z', body: 'b' };
    await syncGmailWithMessages({
      messages: [email],
      classifier: async () => {
        throw new Error('backend is down');
      },
    });
    expect(set).not.toHaveBeenCalled();
  });
});
