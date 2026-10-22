import { SiteAdapter } from './types';
import { Job } from '../lib/schemas/job';
import { FormField } from '../lib/messaging';
import { discoverFields, fillFieldWithEngine } from '../lib/fill/engine';
import { setupSubmissionDetector } from '../lib/fill/submission';

export class LeverAdapter implements SiteAdapter {
  matches(url: URL): boolean {
    if (url.hostname !== 'jobs.lever.co') return false;
    // Lever postings have /company/<job-id>
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length >= 2;
  }

  extractJob(doc: Document): Partial<Job> {
    const title = doc.querySelector('.posting-header h2, h2')?.textContent?.trim() || '';
    const location = doc.querySelector('.posting-categories .location, .location')?.textContent?.trim() || '';
    const description = doc.querySelector('.section-page, #content')?.textContent?.trim() || '';

    // Extract company from URL path if possible
    let company = '';
    if (typeof window !== 'undefined' && window.location) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts.length > 0) company = parts[0];
    }

    return {
      title,
      company,
      location,
      description,
      source: 'lever',
    };
  }

  findFormRoot(doc: Document): Element | null {
    return doc.querySelector('#application-form') || doc.querySelector('form');
  }

  listFields(root: Element): FormField[] {
    return discoverFields(root);
  }

  fillField(field: FormField, value: string | File): Promise<boolean> {
    return fillFieldWithEngine(field, value);
  }

  detectSubmission(rootOrOnSubmit: any, onSubmitOrRoot?: any): void {
    const isFn = typeof rootOrOnSubmit === 'function';
    const callback = isFn ? rootOrOnSubmit : onSubmitOrRoot;
    const root = isFn ? (typeof document !== 'undefined' ? document : null) : rootOrOnSubmit;
    if (!root || !callback) return;
    setupSubmissionDetector(root, callback);
  }
}

export const leverAdapter = new LeverAdapter();
