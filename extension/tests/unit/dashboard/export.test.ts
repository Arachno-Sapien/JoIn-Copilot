import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../lib/db';
import { exportDataAsJson, exportDataAsCsv } from '../../../lib/export';

describe('Data Export Unit Tests', () => {
  beforeEach(async () => {
    await db.applications.clear();
    await db.profile.clear();
  });

  it('exports empty state cleanly', async () => {
    const json = await exportDataAsJson();
    const parsed = JSON.parse(json);
    expect(parsed.applications).toEqual([]);
    expect(parsed.profile).toBeNull();

    const csv = await exportDataAsCsv();
    expect(csv).toBe('id,company,title,status,applied_at,notes');
  });
});
