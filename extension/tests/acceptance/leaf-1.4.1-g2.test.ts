import { describe, it, expect } from 'vitest';
import { buildGmailQuery } from '../../lib/gmail';

describe('leaf-1.4.1-g2: Gmail query builder', () => {
  it('builds query containing company names, sender domains, keywords and after filter', () => {
    const lastSync = new Date('2026-10-15T12:00:00Z');
    const query = buildGmailQuery({
      trackedCompanies: ['Stripe', 'Google', 'Airbnb'],
      senderDomains: ['stripe.com', 'google.com'],
      lastSyncTime: lastSync,
    });

    // Check required keywords
    const lower = query.toLowerCase();
    expect(lower).toContain('application');
    expect(lower).toContain('interview');
    expect(lower).toContain('assessment');

    // Check tracked company names and domains
    expect(query).toContain('Stripe');
    expect(query).toContain('Google');
    expect(query).toContain('Airbnb');
    expect(query).toContain('stripe.com');

    // Check after timestamp
    const expectedEpochSec = Math.floor(lastSync.getTime() / 1000);
    expect(query).toMatch(new RegExp(`after:(${expectedEpochSec}|2026[/\\-]10[/\\-]15)`));
  });

  it('handles empty tracked list with default terms and after timestamp', () => {
    const query = buildGmailQuery({
      lastSyncTime: new Date('2026-10-10T00:00:00Z'),
    });
    const lower = query.toLowerCase();
    expect(lower).toContain('application');
    expect(lower).toContain('interview');
    expect(lower).toContain('assessment');
    expect(query).toContain('after:');
  });
});
