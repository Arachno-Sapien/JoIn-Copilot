import { SiteAdapter } from './types';
import { Job } from '../lib/schemas/job';
import { FormField } from '../lib/messaging';
import { discoverFields, fillFieldWithEngine } from '../lib/fill/engine';
import { setupSubmissionDetector } from '../lib/fill/submission';

export class GenericAdapter implements SiteAdapter {
  matches(url: URL): boolean {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  extractJob(doc: Document): Partial<Job> {
    const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || '';
    const description = doc.querySelector('main, article, #content, .job-description')?.textContent?.trim() || '';

    return {
      title,
      description,
      source: 'manual',
    };
  }

  findFormRoot(doc: Document): Element | null {
    return doc.querySelector('form') || doc.body;
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

export const genericAdapter = new GenericAdapter();
