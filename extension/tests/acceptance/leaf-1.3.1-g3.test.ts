// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { leverAdapter } from '../../adapters/lever';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('leaf-1.3.1:G3 Lever Form Filling and Free-text Drafts', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Load Lever snapshot
    const snapshotPath = resolve(__dirname, '../unit/fill/snapshots/lever/application.html');
    const html = readFileSync(snapshotPath, 'utf8');
    document.body.innerHTML = html;
    container = document.body.querySelector('form') || document.body;
  });

  it('fills name, email, phone, resume file, and free-text draft answer on Lever form and reads back', async () => {
    const fields = leverAdapter.listFields(container);
    expect(fields.length).toBeGreaterThan(0);

    const testDraftAnswer = 'I have built distributed Python and TypeScript services with proven high reliability.';
    const testData: Record<string, string | File> = {
      name: 'Alex Doe',
      email: 'alex.doe@example.com',
      phone: '+1-555-0199',
      resume: new File(['%PDF-1.4 synthetic lever resume'], 'resume.pdf', { type: 'application/pdf' }),
      comments: testDraftAnswer,
    };

    for (const field of fields) {
      const lowerName = (field.name || '').toLowerCase();
      const lowerLabel = (field.label || '').toLowerCase();

      if (lowerName === 'name' || lowerLabel.includes('full name') || lowerLabel === 'name') {
        const ok = await leverAdapter.fillField(field, testData.name);
        expect(ok).toBe(true);
      } else if (lowerName.includes('email') || lowerLabel.includes('email')) {
        const ok = await leverAdapter.fillField(field, testData.email);
        expect(ok).toBe(true);
      } else if (lowerName.includes('phone') || lowerLabel.includes('phone')) {
        const ok = await leverAdapter.fillField(field, testData.phone);
        expect(ok).toBe(true);
      } else if (field.type === 'file' || lowerName.includes('resume') || lowerLabel.includes('resume')) {
        const ok = await leverAdapter.fillField(field, testData.resume);
        expect(ok).toBe(true);
      } else if (field.type === 'textarea' || lowerName.includes('comments') || lowerLabel.includes('additional') || lowerLabel.includes('why')) {
        const ok = await leverAdapter.fillField(field, testData.comments);
        expect(ok).toBe(true);
      }
    }

    // Read back values from DOM
    const nameInput = container.querySelector<HTMLInputElement>('input[name="name"]');
    const emailInput = container.querySelector<HTMLInputElement>('input[name="email"]');
    const phoneInput = container.querySelector<HTMLInputElement>('input[name="phone"]');
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    const textareaInput = container.querySelector<HTMLTextAreaElement>('textarea');

    expect(nameInput?.value).toBe('Alex Doe');
    expect(emailInput?.value).toBe('alex.doe@example.com');
    expect(phoneInput?.value).toBe('+1-555-0199');
    expect(fileInput?.files?.length).toBe(1);
    expect(fileInput?.files?.[0]?.name).toBe('resume.pdf');
    expect(textareaInput?.value).toBe(testDraftAnswer);
  });
});
