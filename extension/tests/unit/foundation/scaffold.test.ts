import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../lib/settings';

describe('Extension foundation scaffold', () => {
  it('has default settings pointing to localhost backend', () => {
    expect(DEFAULT_SETTINGS.backendUrl).toBe('http://127.0.0.1:8000');
  });
});
