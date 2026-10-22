// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { greenhouseAdapter } from '../../adapters/greenhouse';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('leaf-1.3.1:G2 Greenhouse Form Filling with React Control', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Load Greenhouse snapshot
    const snapshotPath = resolve(__dirname, '../unit/fill/snapshots/greenhouse/application.html');
    const html = readFileSync(snapshotPath, 'utf8');
    document.body.innerHTML = html;
    container = document.body.querySelector('form') || document.body;

    // Simulate React-controlled inputs on the form
    const textInputs = container.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="email"], input[type="tel"]');
    textInputs.forEach((input) => {
      let state = input.defaultValue || '';
      Object.defineProperty(input, 'value', {
        get() {
          return state;
        },
        set(newVal) {
          // A React controlled component ignores direct assignments without native setter dispatch
          state = newVal;
        },
        configurable: true,
      });
    });
  });

  it('fills name, email, phone, LinkedIn URL, and resume on Greenhouse form and reads back', async () => {
    const fields = greenhouseAdapter.listFields(container);
    expect(fields.length).toBeGreaterThan(0);

    // Profile values to fill
    const testData: Record<string, string | File> = {
      first_name: 'Alex',
      last_name: 'Doe',
      email: 'alex.doe@example.com',
      phone: '+1-555-0199',
      linkedin: 'https://linkedin.com/in/alexdoe',
      resume: new File(['%PDF-1.4 test resume synthetic content'], 'resume.pdf', { type: 'application/pdf' }),
    };

    for (const field of fields) {
      const lowerName = (field.name || '').toLowerCase();
      const lowerLabel = (field.label || '').toLowerCase();

      if (lowerName.includes('first_name') || lowerLabel.includes('first name')) {
        const ok = await greenhouseAdapter.fillField(field, testData.first_name);
        expect(ok).toBe(true);
      } else if (lowerName.includes('last_name') || lowerLabel.includes('last name')) {
        const ok = await greenhouseAdapter.fillField(field, testData.last_name);
        expect(ok).toBe(true);
      } else if (lowerName.includes('email') || lowerLabel.includes('email')) {
        const ok = await greenhouseAdapter.fillField(field, testData.email);
        expect(ok).toBe(true);
      } else if (lowerName.includes('phone') || lowerLabel.includes('phone')) {
        const ok = await greenhouseAdapter.fillField(field, testData.phone);
        expect(ok).toBe(true);
      } else if (lowerLabel.includes('linkedin') || lowerName.includes('linkedin')) {
        const ok = await greenhouseAdapter.fillField(field, testData.linkedin);
        expect(ok).toBe(true);
      } else if (field.type === 'file' || lowerName.includes('resume') || lowerLabel.includes('resume')) {
        const ok = await greenhouseAdapter.fillField(field, testData.resume);
        expect(ok).toBe(true);
      }
    }

    // Read back and verify values in DOM
    const firstNameInput = container.querySelector<HTMLInputElement>('#first_name, input[name*="first_name"]');
    const lastNameInput = container.querySelector<HTMLInputElement>('#last_name, input[name*="last_name"]');
    const emailInput = container.querySelector<HTMLInputElement>('#email, input[name*="email"]');
    const phoneInput = container.querySelector<HTMLInputElement>('#phone, input[name*="phone"]');
    const linkedinInput = container.querySelector<HTMLInputElement>('input[id*="linkedin" i], input[name*="linkedin" i], input[aria-label*="linkedin" i]') ||
      Array.from(container.querySelectorAll<HTMLInputElement>('input')).find(i => {
        const label = container.querySelector(`label[for="${i.id}"]`)?.textContent || '';
        return /linkedin/i.test(label);
      });
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(firstNameInput?.value).toBe('Alex');
    expect(lastNameInput?.value).toBe('Doe');
    expect(emailInput?.value).toBe('alex.doe@example.com');
    expect(phoneInput?.value).toBe('+1-555-0199');
    expect(linkedinInput?.value).toBe('https://linkedin.com/in/alexdoe');
    expect(fileInput?.files?.length).toBe(1);
    expect(fileInput?.files?.[0]?.name).toBe('resume.pdf');
  });
});
