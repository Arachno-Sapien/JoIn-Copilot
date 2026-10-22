// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { verifyFields } from '../../lib/fill/verify';
import { FormField } from '../../lib/messaging';

describe('leaf-1.3.1:G6 Form Filling Verification Pass', () => {
  let container: HTMLFormElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="app-form">
        <input id="name" name="name" type="text" value="Jane Doe" />
        <input id="phone" name="phone" type="tel" value="(555) 123-4567" />
        <input id="salary" name="salary" type="text" value="" />
      </form>
    `;
    container = document.querySelector('form')!;
  });

  it('reports exact matches as verified, reformatted values as reformatted, and cleared/rejected as rejected', () => {
    const fieldsToVerify: Array<{ field: FormField; intendedValue: string }> = [
      {
        field: { name: 'name', id: 'name', type: 'text' },
        intendedValue: 'Jane Doe', // matches DOM value
      },
      {
        field: { name: 'phone', id: 'phone', type: 'tel' },
        intendedValue: '5551234567', // DOM reformatted to "(555) 123-4567"
      },
      {
        field: { name: 'salary', id: 'salary', type: 'text' },
        intendedValue: '$100,000', // DOM is empty -> rejected
      },
    ];

    const result = verifyFields(container, fieldsToVerify);

    expect(result.verified.length).toBe(1);
    expect(result.verified[0].field.name).toBe('name');

    expect(result.mismatches.length).toBe(2);

    const phoneMismatch = result.mismatches.find((m) => m.field.name === 'phone');
    expect(phoneMismatch).toBeDefined();
    expect(phoneMismatch?.status).toBe('reformatted');
    expect(phoneMismatch?.expected).toBe('5551234567');
    expect(phoneMismatch?.actual).toBe('(555) 123-4567');

    const salaryMismatch = result.mismatches.find((m) => m.field.name === 'salary');
    expect(salaryMismatch).toBeDefined();
    expect(salaryMismatch?.status).toBe('rejected');
    expect(salaryMismatch?.expected).toBe('$100,000');
    expect(salaryMismatch?.actual).toBe('');
  });
});
