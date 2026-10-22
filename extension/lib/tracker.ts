import { db } from './db';
import {
  Application,
  ApplicationStatus,
  ApplicationStatusSchema,
  Answer,
} from './schemas/application';
import { ApplicationSubmittedMessage } from './messaging';
import { Job } from './schemas/job';

export interface ApplicationSubmitContext {
  job?: Partial<Omit<Job, 'source'>> & { source?: string };
  fit_score?: number;
  missing_skills?: string[];
  resume_version?: string;
}

/**
 * Handles an APPLICATION_SUBMITTED event and records a new Application in IndexedDB.
 */
export async function handleApplicationSubmitted(
  message: ApplicationSubmittedMessage,
  context?: ApplicationSubmitContext
): Promise<Application> {
  const appliedAt = new Date().toISOString();
  const id = `app_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const answers: Answer[] = Object.entries(message.answers || {}).map(([question, answer]) => ({
    question,
    answer: String(answer),
    flags: [],
  }));

  const application: Application = {
    schema_version: 1,
    id,
    job_id: message.jobId,
    job_snapshot: {
      title: context?.job?.title || 'Applied Position',
      company: context?.job?.company || 'Company',
      url: message.url || context?.job?.url || '',
      source: context?.job?.source || 'ats',
    },
    applied_at: appliedAt,
    fit_score: context?.fit_score ?? 0,
    missing_skills: context?.missing_skills ?? [],
    resume_version: context?.resume_version || 'default',
    answers,
    status: 'applied',
    status_history: [
      {
        status: 'applied',
        at: appliedAt,
        source: 'user',
      },
    ],
    notes: '',
  };

  await db.applications.put(application);
  return application;
}

/**
 * Updates application status and appends a record to status_history.
 * Rejects any unknown or invalid status.
 */
export async function updateApplicationStatus(
  id: string,
  newStatus: ApplicationStatus,
  source: 'user' | 'gmail' | 'portal' | 'auto',
  at: string = new Date().toISOString() // when it happened, e.g. the recruiter email's date
): Promise<Application> {
  const parseResult = ApplicationStatusSchema.safeParse(newStatus);
  if (!parseResult.success) {
    throw new Error(`Invalid application status: ${newStatus}`);
  }

  const app = await db.applications.get(id);
  if (!app) {
    throw new Error(`Application ${id} not found in database`);
  }

  // `at` may come from an email's sender-controlled Date header: keep it between the
  // latest known event and now, so history never moves backwards or into the future.
  const nowMs = Date.now();
  let atMs = new Date(at).getTime();
  if (Number.isNaN(atMs) || atMs > nowMs) atMs = nowMs;
  atMs = Math.max(atMs, latestEventMs(app));

  app.status = parseResult.data;
  app.status_history.push({
    status: parseResult.data,
    at: new Date(atMs).toISOString(),
    source,
  });

  await db.applications.put(app);
  return app;
}

/** Latest valid timestamp across applied_at and the whole status history (0 if none). */
function latestEventMs(app: Application): number {
  const times = [app.applied_at, ...(app.status_history ?? []).map((h) => h.at)]
    .map((t) => new Date(t).getTime())
    .filter((ms) => !Number.isNaN(ms));
  return times.length ? Math.max(...times) : 0;
}

const TERMINAL_STATUSES: Set<string> = new Set(['rejected', 'offer', 'withdrawn', 'no_response']);
const NO_RESPONSE_THRESHOLD_MS = 28 * 24 * 60 * 60 * 1000; // 28 days

/**
 * Scans active applications and marks any with no update for 28 days as no_response (source: auto) exactly once.
 */
export async function sweepNoResponseApplications(now: Date = new Date()): Promise<number> {
  const allApps = await db.applications.toArray();
  let updatedCount = 0;

  for (const app of allApps) {
    if (TERMINAL_STATUSES.has(app.status)) {
      continue;
    }

    if (now.getTime() - latestEventMs(app) >= NO_RESPONSE_THRESHOLD_MS) {
      app.status = 'no_response';
      app.status_history.push({
        status: 'no_response',
        at: now.toISOString(),
        source: 'auto',
      });
      await db.applications.put(app);
      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Alarm handler for periodic background tasks.
 */
export async function handleTrackerAlarm(alarm: { name: string }, now?: Date): Promise<number> {
  if (alarm.name === 'no_response_sweep') {
    return await sweepNoResponseApplications(now);
  }
  return 0;
}
