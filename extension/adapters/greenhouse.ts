import { SiteAdapter } from './types';
import { Job } from '../lib/schemas/job';
import { FormField } from '../lib/messaging';
import { discoverFields, fillFieldWithEngine } from '../lib/fill/engine';
import { setupSubmissionDetector } from '../lib/fill/submission';

export class GreenhouseAdapter implements SiteAdapter {
  matches(url: URL): boolean {
    const isGreenhouseHost =
      url.hostname === 'boards.greenhouse.io' || url.hostname === 'job-boards.greenhouse.io';
    if (!isGreenhouseHost) return false;
    // Greenhouse job postings have /jobs/<id>
    return /\/jobs\/\d+/.test(url.pathname);
  }

  extractJob(doc: Document): Partial<Job> {
    const title =
      doc.querySelector('h1.app-title, h1.job-title, .job-title')?.textContent?.trim() || '';
    const company = doc.querySelector('.company-name')?.textContent?.trim() || '';
    const location = doc.querySelector('.location')?.textContent?.trim() || '';
    const description = doc.querySelector('#content')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description,
      source: 'greenhouse',
    };
  }

  findFormRoot(doc: Document): Element | null {
    return doc.querySelector('#application_form') || doc.querySelector('form');
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

export const greenhouseAdapter = new GreenhouseAdapter();
