import Dexie, { type Table } from 'dexie';
import type { Profile } from './schemas/profile';
import type { Application } from './schemas/application';
import type { ScoredJob } from './schemas/search';
import type { ScamCheckResponse } from './schemas/scam';
import type { PendingConfirmation } from './schemas/email';

export interface StoredProfile extends Profile {
  id: string; // typically 'main'
}

export interface StoredResume {
  id: string;
  filename: string;
  data: Blob;
  uploadedAt: string;
}

export type ListedJob = Omit<ScoredJob, 'fit_score'> & { fit_score: number | null };

export interface SavedJob {
  id: string;
  ranked: ListedJob;
  scam?: ScamCheckResponse;
  savedAt: string;
}

export interface StoredPendingConfirmation extends PendingConfirmation {
  id: string;
  messageId: string;
}

export interface StoredProcessedEmail {
  id: string;
  processedAt: string;
}

export class AppDatabase extends Dexie {
  profile!: Table<StoredProfile, string>;
  applications!: Table<Application, string>;
  resumes!: Table<StoredResume, string>;
  jobs!: Table<SavedJob, string>;
  pendingConfirmations!: Table<StoredPendingConfirmation, string>;
  processedEmails!: Table<StoredProcessedEmail, string>;

  constructor() {
    super('JobCopilotDB');

    // Version 1: initial schema
    this.version(1).stores({
      profile: 'id, name, email',
      applications: 'id, job_id, status, applied_at',
      resumes: 'id, filename',
    });

    // Version 2: migration adding indexes and uploadedAt
    this.version(2).stores({
      profile: 'id, name, email',
      applications: 'id, job_id, status, applied_at',
      resumes: 'id, filename, uploadedAt',
    }).upgrade((tx) => {
      return tx.table('resumes').toCollection().modify((resume) => {
        if (!resume.uploadedAt) {
          resume.uploadedAt = new Date().toISOString();
        }
      });
    });

    // Version 3: saved jobs, pending confirmations, processed emails
    this.version(3).stores({
      profile: 'id, name, email',
      applications: 'id, job_id, status, applied_at',
      resumes: 'id, filename, uploadedAt',
      jobs: 'id, savedAt',
      pendingConfirmations: 'id, applicationId',
      processedEmails: 'id, processedAt',
    });
  }
}

export const db = new AppDatabase();

