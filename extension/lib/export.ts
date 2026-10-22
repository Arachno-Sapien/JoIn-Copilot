import { db } from './db';

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportDataAsJson(): Promise<string> {
  const profile = await db.profile.get('main');
  const applications = await db.applications.toArray();
  const resumes = (await db.resumes.toArray()).map((r) => ({
    id: r.id,
    filename: r.filename,
    uploadedAt: r.uploadedAt,
  }));

  const data = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    profile: profile || null,
    applications,
    resumes,
  };

  return JSON.stringify(data, null, 2);
}

export async function exportDataAsCsv(): Promise<string> {
  const applications = await db.applications.toArray();
  const headers = ['id', 'company', 'title', 'status', 'applied_at', 'notes'];

  const rows = applications.map((app) => [
    escapeCsvField(app.id),
    escapeCsvField(app.job_snapshot?.company || ''),
    escapeCsvField(app.job_snapshot?.title || ''),
    escapeCsvField(app.status),
    escapeCsvField(app.applied_at),
    escapeCsvField(app.notes || ''),
  ]);

  const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];
  return csvLines.join('\n');
}

export async function deleteAllUserData(): Promise<void> {
  await db.profile.clear();
  await db.applications.clear();
  await db.resumes.clear();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.clear();
  }
}
