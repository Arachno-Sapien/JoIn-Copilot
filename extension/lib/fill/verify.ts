import { FormField } from '../messaging';
import { findElementForField } from './engine';

export interface VerificationMismatch {
  field: FormField;
  expected: string;
  actual: string;
  status: 'reformatted' | 'rejected' | 'mismatch';
}

export interface VerificationResult {
  verified: Array<{ field: FormField; value: string }>;
  mismatches: VerificationMismatch[];
}

/**
 * Re-reads every filled field from the DOM and checks against the intended value.
 */
export function verifyFields(
  root: Element | Document,
  fieldsToVerify: Array<{ field: FormField; intendedValue: string }>
): VerificationResult {
  const verified: Array<{ field: FormField; value: string }> = [];
  const mismatches: VerificationMismatch[] = [];

  for (const item of fieldsToVerify) {
    const el = findElementForField(root, item.field);
    if (!el) {
      mismatches.push({
        field: item.field,
        expected: item.intendedValue,
        actual: '',
        status: 'rejected',
      });
      continue;
    }

    let actual = '';
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      actual = el.value;
    }

    if (actual === item.intendedValue) {
      verified.push({ field: item.field, value: actual });
    } else if (actual.trim() === '' && item.intendedValue.trim() !== '') {
      mismatches.push({
        field: item.field,
        expected: item.intendedValue,
        actual,
        status: 'rejected',
      });
    } else {
      mismatches.push({
        field: item.field,
        expected: item.intendedValue,
        actual,
        status: 'reformatted',
      });
    }
  }

  return { verified, mismatches };
}
