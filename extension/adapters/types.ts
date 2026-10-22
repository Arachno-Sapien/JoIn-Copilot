import { Job } from '../lib/schemas/job';
import { FormField } from '../lib/messaging';

export interface SiteAdapter {
  matches(url: URL): boolean;
  extractJob(doc: Document): Partial<Job>;
  findFormRoot(doc: Document): Element | null;
  listFields(root: Element): FormField[];
  fillField(field: FormField, value: string | File): Promise<boolean>;
  detectSubmission(rootOrOnSubmit: any, onSubmitOrRoot?: any): void;
}
