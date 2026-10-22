import Dexie, { type Table } from 'dexie';
import type { Profile } from './schemas/profile';
import type { Application } from './schemas/application';

export interface StoredProfile extends Profile {
  id: string; // typically 'main'
}

export interface StoredResume {
  id: string;
  filename: string;
  data: Blob;
  uploadedAt: string;
}

export class AppDatabase extends Dexie {
  profile!: Table<StoredProfile, string>;
  applications!: Table<Application, string>;
  resumes!: Table<StoredResume, string>;

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
  }
}

export const db = new AppDatabase();
