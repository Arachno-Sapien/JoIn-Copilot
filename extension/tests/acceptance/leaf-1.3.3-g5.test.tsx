// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FillReview } from '../../components/sidepanel/FillReview';
import { FormField, FilledField } from '../../lib/messaging';

afterEach(() => {
  cleanup();
});

describe('leaf-1.3.3:G5 Fill Review Component Safety', () => {
  const filledFields: FilledField[] = [
    { name: 'first_name', value: 'Alex' },
    { name: 'last_name', value: 'Doe' },
    { name: 'email', value: 'alex@example.com' },
    { name: 'phone', value: '+1-555-0199' },
  ];

  const skippedFields: FormField[] = [
    { name: 'security_code', label: 'Security Code', manual: true },
    { name: 'custom_referral', label: 'How did you hear about us?' },
  ];

  it('lists filled and skipped fields and offers NO control that submits the application', () => {
    const { container } = render(
      <FillReview filled={filledFields} skipped={skippedFields} />
    );

    // Lists filled fields
    expect(screen.getByText(/first_name/i)).toBeDefined();
    expect(screen.getByText('alex@example.com')).toBeDefined();

    // Lists skipped fields
    expect(screen.getByText(/Security Code/i)).toBeDefined();
    expect(screen.getByText(/How did you hear about us/i)).toBeDefined();

    // Critical safety check: no button or input that submits
    const allButtons = container.querySelectorAll('button, input[type="submit"], [role="button"]');
    allButtons.forEach((btn) => {
      const text = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
      expect(text).not.toContain('submit application');
      expect(text).not.toContain('auto-submit');
      expect(text).not.toMatch(/^submit$/i);
    });

    // Contains reminder for manual submission
    expect(screen.getByText(/submit the form on the page yourself/i)).toBeDefined();
  });
});
