// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { OptionsApp } from '../../entrypoints/options/App';
import { getBackendUrl } from '../../lib/settings';

describe('leaf-1.4.2:G3 Options backend URL setting updates storage and API client', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = { backendUrl: 'http://localhost:8000' };
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: any, cb?: (res: any) => void) => {
            const res = typeof keys === 'string'
              ? { [keys]: mockStorage[keys] }
              : Array.isArray(keys)
                ? keys.reduce((acc, k) => ({ ...acc, [k]: mockStorage[k] }), {})
                : mockStorage;
            if (cb) cb(res);
            return Promise.resolve(res);
          }),
          set: vi.fn((items: any, cb?: () => void) => {
            Object.assign(mockStorage, items);
            if (cb) cb();
            return Promise.resolve();
          }),
        },
      },
      alarms: {
        clear: vi.fn(),
      },
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('updates backend URL in options, saves to chrome.storage.local and updates getBackendUrl immediately', async () => {
    render(<OptionsApp />);

    const input = (await screen.findByLabelText(/backend url/i)) as HTMLInputElement;
    expect(input.value).toBe('http://localhost:8000');

    // Change value and submit/save
    fireEvent.change(input, { target: { value: 'http://localhost:9999' } });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(async () => {
      expect(mockStorage.backendUrl).toBe('http://localhost:9999');
      const currentUrl = await getBackendUrl();
      expect(currentUrl).toBe('http://localhost:9999');
    });
  });
});
