import { describe, it, expect } from 'vitest';
import { buildGmailQuery } from '../../../lib/gmail';

describe('Gmail Query Builder Unit Tests', () => {
  it('combines multiple companies and domains correctly', () => {
    const query = buildGmailQuery({
      trackedCompanies: ['Apple', 'Microsoft', 'Netflix'],
      senderDomains: ['apple.com', 'microsoft.com'],
      lastSyncTime: new Date('2026-10-18T00:00:00Z'),
    });

    expect(query).toContain('(application OR interview OR assessment)');
    expect(query).toContain('"Apple"');
    expect(query).toContain('"Microsoft"');
    expect(query).toContain('"Netflix"');
    expect(query).toContain('from:apple.com');
    expect(query).toContain('from:microsoft.com');
    expect(query).toContain('after:');
  });

  it('handles null options gracefully', () => {
    const query = buildGmailQuery();
    expect(query).toBe('(application OR interview OR assessment)');
  });
});
