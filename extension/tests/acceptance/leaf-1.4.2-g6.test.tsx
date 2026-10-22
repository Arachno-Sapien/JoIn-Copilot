// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { OptionsApp } from '../../entrypoints/options/App';

describe('leaf-1.4.2:G6 Privacy controls toggle off Gmail sync and clear its alarm', () => {
  let mockStorage: Record<string, any> = {};
  let clearAlarmMock: any;

  beforeEach(() => {
    mockStorage = { gmail_sync_enabled: true };
    clearAlarmMock = vi.fn();

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: any, cb?: (res: any) => void) => {
            const res = typeof keys === 'string' ? { [keys]: mockStorage[keys] } : mockStorage;
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
        clear: clearAlarmMock,
      },
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('clears gmail_sync alarm when user disables Gmail sync in privacy settings', async () => {
    render(<OptionsApp />);

    const toggle = (await screen.findByLabelText(/enable gmail sync/i)) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    // Turn toggle off
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(clearAlarmMock).toHaveBeenCalledWith('gmail_sync');
      expect(mockStorage.gmail_sync_enabled).toBe(false);
    });
  });
});
