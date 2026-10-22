// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DraftView } from '../../components/sidepanel/DraftView';
import { DraftResponse } from '../../lib/schemas/draft';

afterEach(() => {
  cleanup();
});

describe('leaf-1.3.3:G4 Draft View with Fabrication Highlights and Rewrite', () => {
  const sampleDraft: DraftResponse = {
    draft: 'I managed Kubernetes clusters in production with 99.99% uptime and led 10 engineers.',
    claims: [
      {
        claim: 'managed Kubernetes clusters in production with 99.99% uptime',
        judgment: 'unsupported',
        reason: 'Resume lists Docker basics but no Kubernetes or production uptime metric.',
      },
      {
        claim: 'led 10 engineers',
        judgment: 'partly_supported',
        reason: 'Resume states coordinated team of 4 interns, not led 10 engineers.',
      },
    ],
    verdict: 'unsupported',
    rewritten_draft: 'I have hands-on experience containerizing services with Docker and collaborated closely in team environments.',
    cited_bullet_ids: [],
  };

  it('marks unsupported claims red, partly supported amber with reasons, and offers rewrite', () => {
    render(<DraftView initialDraft={sampleDraft} />);

    // Check unsupported claim and reason
    const unsupportedEl = screen.getByTestId('claim-unsupported');
    expect(unsupportedEl).toBeDefined();
    expect(unsupportedEl.textContent).toContain('managed Kubernetes clusters');
    expect(screen.getByText(/Resume lists Docker basics/i)).toBeDefined();

    // Check partly supported claim and reason
    const partlySupportedEl = screen.getByTestId('claim-partly_supported');
    expect(partlySupportedEl).toBeDefined();
    expect(partlySupportedEl.textContent).toContain('led 10 engineers');
    expect(screen.getByText(/Resume states coordinated team/i)).toBeDefined();

    // Verify style/classes: unsupported has red, partly supported has amber
    expect(unsupportedEl.getAttribute('data-status-color')).toBe('red');
    expect(partlySupportedEl.getAttribute('data-status-color')).toBe('amber');

    // Offers rewrite
    const rewriteBtn = screen.getByRole('button', { name: /apply rewrite|use rewrite/i });
    expect(rewriteBtn).toBeDefined();

    // Clicking rewrite updates the draft view
    fireEvent.click(rewriteBtn);
    expect(screen.getByText(/I have hands-on experience containerizing services with Docker/i)).toBeDefined();
  });
});
