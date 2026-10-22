import { db } from './db';
import { updateApplicationStatus } from './tracker';
import { classifyEmail } from './api/email';
import { getGmailAuthToken } from './gmail-auth';
import {
  CandidateApplication,
  EmailClassifyResponse,
  EmailInput,
  PendingConfirmation,
} from './schemas/email';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;
const LAST_SYNC_KEY = 'last_gmail_sync_timestamp';

export function buildGmailQuery(options?: {
  trackedCompanies?: string[];
  senderDomains?: string[];
  lastSyncTime?: Date | string | null;
}): string {
  const baseKeywords = '(application OR interview OR assessment)';
  const clauses: string[] = [baseKeywords];

  const targetFilters: string[] = [];
  if (options?.trackedCompanies && options.trackedCompanies.length > 0) {
    for (const comp of options.trackedCompanies) {
      if (comp && comp.trim()) {
        targetFilters.push(`"${comp.trim()}"`);
      }
    }
  }
  if (options?.senderDomains && options.senderDomains.length > 0) {
    for (const dom of options.senderDomains) {
      if (dom && dom.trim()) {
        targetFilters.push(`from:${dom.trim()}`);
      }
    }
  }

  if (targetFilters.length > 0) {
    clauses.push(`(${targetFilters.join(' OR ')})`);
  }

  if (options?.lastSyncTime) {
    const date = typeof options.lastSyncTime === 'string' ? new Date(options.lastSyncTime) : options.lastSyncTime;
    if (!isNaN(date.getTime())) {
      const epochSec = Math.floor(date.getTime() / 1000);
      clauses.push(`after:${epochSec}`);
    }
  }

  return clauses.join(' ');
}

export async function handleEmailClassificationResult(params: {
  classification: EmailClassifyResponse;
  email: EmailInput;
  threshold?: number;
}): Promise<PendingConfirmation | null> {
  const threshold = params.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const { matched_application_id, classification, confidence } = params.classification;

  if (!matched_application_id) {
    return null;
  }

  // Retrieve candidate application from db
  const app = await db.applications.get(matched_application_id);
  if (!app) {
    return null;
  }

  if (confidence >= threshold) {
    // High confidence: update automatically
    const statusMap: Record<string, any> = {
      acknowledgement: 'viewed',
      rejection: 'rejected',
      assessment: 'assessment',
      interview: 'interview',
      offer: 'offer',
    };
    const targetStatus = statusMap[classification] || 'viewed';
    await updateApplicationStatus(matched_application_id, targetStatus, 'gmail', params.email.date);
    return null;
  }

  // Low confidence: require explicit user confirmation
  const pending: PendingConfirmation = {
    id: `conf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    applicationId: matched_application_id,
    company: app.job_snapshot.company,
    role: app.job_snapshot.title,
    detectedStatus: classification,
    confidence,
    subject: params.email.subject,
    date: params.email.date,
  };

  return pending;
}

export async function syncGmailWithMessages(options: {
  messages: EmailInput[];
  classifier?: (email: EmailInput, candidates: CandidateApplication[]) => Promise<EmailClassifyResponse>;
  threshold?: number;
}): Promise<{ updatedCount: number; pendingConfirmations: PendingConfirmation[] }> {
  const classifier = options.classifier ?? classifyEmail;
  const threshold = options.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const applications = await db.applications.toArray();
  const candidates: CandidateApplication[] = applications.map((a) => ({
    id: a.id,
    company: a.job_snapshot.company,
    role: a.job_snapshot.title,
  }));

  let updatedCount = 0;
  const pendingConfirmations: PendingConfirmation[] = [];

  for (const message of options.messages) {
    try {
      const result = await classifier(message, candidates);
      const pending = await handleEmailClassificationResult({
        classification: result,
        email: message,
        threshold,
      });

      if (pending) {
        pendingConfirmations.push(pending);
      } else if (result.matched_application_id) {
        updatedCount++;
      }
    } catch {
      // Continue processing other messages
    }
  }

  // Update sync timestamp in chrome.storage if available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [LAST_SYNC_KEY]: new Date().toISOString() });
  }

  return { updatedCount, pendingConfirmations };
}

export async function getLastSyncTime(): Promise<Date | null> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const res = await chrome.storage.local.get(LAST_SYNC_KEY);
    const ts = res[LAST_SYNC_KEY];
    if (ts) {
      return new Date(ts);
    }
  }
  return null;
}

export async function syncGmail(): Promise<{ updatedCount: number; pendingConfirmations: PendingConfirmation[] }> {
  const token = await getGmailAuthToken(false);
  const applications = await db.applications.toArray();
  const trackedCompanies = Array.from(new Set(applications.map((a) => a.job_snapshot.company)));
  const lastSyncTime = await getLastSyncTime();

  const query = buildGmailQuery({
    trackedCompanies,
    lastSyncTime,
  });

  const messageIds = await searchGmailMessageIds(token, query);
  const messages: EmailInput[] = [];

  for (const id of messageIds.slice(0, 20)) {
    try {
      const msg = await fetchGmailMessage(token, id);
      messages.push(msg);
    } catch {
      // Skip failed message fetch
    }
  }

  return syncGmailWithMessages({ messages });
}

async function searchGmailMessageIds(token: string, query: string): Promise<string[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail search failed: ${res.status}`);
  }
  const data = await res.json();
  return (data.messages || []).map((m: any) => m.id);
}

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return '';
  }
}

async function fetchGmailMessage(token: string, id: string): Promise<EmailInput> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch message ${id}: ${res.status}`);
  }
  const data = await res.json();

  const headers = data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const sender = getHeader('From');
  const subject = getHeader('Subject');
  const dateStr = getHeader('Date');
  const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

  // Extract body text
  let body = '';
  if (data.payload?.body?.data) {
    body = decodeBase64Url(data.payload.body.data);
  } else if (data.payload?.parts) {
    for (const part of data.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = decodeBase64Url(part.body.data);
        break;
      }
      if (part.mimeType === 'text/html' && part.body?.data && !body) {
        body = decodeBase64Url(part.body.data);
      }
    }
  }

  return {
    sender,
    subject,
    date,
    body,
  };
}
