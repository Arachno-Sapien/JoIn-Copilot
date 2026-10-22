import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGmailAuthToken, GMAIL_SCOPE } from '../../../lib/gmail-auth';

describe('Gmail Auth Helper Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls chrome.identity.getAuthToken with gmail.readonly scope', async () => {
    const mockGetAuthToken = vi.fn((options, callback) => {
      expect(options.scopes).toEqual([GMAIL_SCOPE]);
      callback('mock-oauth-token-12345');
    });

    (globalThis as any).chrome = {
      runtime: {},
      identity: {
        getAuthToken: mockGetAuthToken,
      },
    };

    const token = await getGmailAuthToken(true);
    expect(token).toBe('mock-oauth-token-12345');
    expect(mockGetAuthToken).toHaveBeenCalledWith(
      { interactive: true, scopes: [GMAIL_SCOPE] },
      expect.any(Function)
    );
  });

  it('rejects if no token is returned and error occurs', async () => {
    (globalThis as any).chrome = {
      runtime: {
        lastError: { message: 'User denied OAuth prompt' },
      },
      identity: {
        getAuthToken: vi.fn((_options, callback) => {
          callback(undefined);
        }),
      },
    };

    await expect(getGmailAuthToken(false)).rejects.toThrow('User denied OAuth prompt');
  });
});
