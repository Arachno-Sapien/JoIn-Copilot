// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { fillActivePage } from '../../../lib/fill/page';
import { FillReview } from '../../../components/sidepanel/FillReview';
import * as fillApi from '../../../lib/api/fill';
import * as draftApi from '../../../lib/api/draft';
import { Profile } from '../../../lib/schemas/profile';
import { Job } from '../../../lib/schemas/job';

describe('AI field mapping in fillActivePage', () => {
  const profile: Profile = {
    name: 'Asha Rao',
    email: 'asha@example.test',
    phone: '',
    location: 'Pune',
    links: {},
    experience: [],
    education: [],
  };

  let sendMessageMock: ReturnType<typeof vi.fn>;
  let executeScriptMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function setupTabs(fields: any[]) {
    sendMessageMock = vi.fn(async (_tabId: number, message: any) => {
      if (message.type === 'LIST_FIELDS') {
        return { fields };
      }
      if (message.type === 'FILL_REQUEST') {
        const filled = Object.entries(message.values || {}).map(([name, value]) => ({ name, value }));
        const filledNames = new Set(Object.keys(message.values || {}));
        const skipped = fields.filter((f) => !filledNames.has(f.name));
        return {
          filled,
          skipped,
          verify: { verified: [], mismatches: [] },
        };
      }
      return undefined;
    });

    executeScriptMock = vi.fn(async () => {});

    (globalThis as any).chrome = {
      tabs: {
        query: vi.fn(async () => [{ id: 42, url: 'https://jobs.example.com/apply' }]),
        sendMessage: sendMessageMock,
      },
      scripting: {
        executeScript: executeScriptMock,
      },
    };
  }

  it('omits fields answered by local rules from mapFields payload', async () => {
    const fields = [
      { name: 'email', label: 'Email Address', type: 'email' },
      { name: 'full_name', label: 'Full Name', type: 'text' },
      { name: 'years_experience', label: 'Total Years of Experience', type: 'text' },
    ];
    setupTabs(fields);

    const mapFieldsSpy = vi.spyOn(fillApi, 'mapFields').mockResolvedValue({
      mappings: [
        {
          field_id: 'years_experience',
          field_label: 'Total Years of Experience',
          action: 'fill',
          value: '5',
          is_flagged: false,
        },
      ],
      ai_overview: 'Mapped years of experience',
    });

    const result = await fillActivePage(profile);

    expect(mapFieldsSpy).toHaveBeenCalledTimes(1);
    const sentFields = mapFieldsSpy.mock.calls[0][1].fields;
    const sentFieldIds = sentFields.map((f: any) => f.id);

    // Rule-based fields (email, full_name) should NOT be sent to backend
    expect(sentFieldIds).not.toContain('email');
    expect(sentFieldIds).not.toContain('full_name');
    expect(sentFieldIds).toContain('years_experience');

    // Result should contain both rule-based and AI-mapped fields
    const filledNames = result.filled.map((f) => f.name);
    expect(filledNames).toContain('email');
    expect(filledNames).toContain('full_name');
    expect(filledNames).toContain('years_experience');
  });

  it('fills action: "fill" and skips is_flagged: true with reason', async () => {
    const fields = [
      { name: 'favorite_tool', label: 'Favorite Tool', type: 'text' },
      { name: 'ssn', label: 'Social Security Number', type: 'text' },
    ];
    setupTabs(fields);

    vi.spyOn(fillApi, 'mapFields').mockResolvedValue({
      mappings: [
        {
          field_id: 'favorite_tool',
          field_label: 'Favorite Tool',
          action: 'fill',
          value: 'VS Code',
          is_flagged: false,
        },
        {
          field_id: 'ssn',
          field_label: 'Social Security Number',
          action: 'skip',
          is_flagged: true,
          flag_reason: 'Sensitive PII requested',
        },
      ],
    });

    const result = await fillActivePage(profile);

    expect(result.filled).toEqual([{ name: 'favorite_tool', value: 'VS Code' }]);
    const ssnSkipped = result.skipped.find((f) => f.name === 'ssn');
    expect(ssnSkipped).toBeDefined();
    expect(ssnSkipped?.reason).toBe('Sensitive PII requested');
  });

  it('routes open_question mappings to openQuestions and does not fill them', async () => {
    const fields = [
      { name: 'why_us', label: 'Why do you want to join us?', type: 'textarea' },
    ];
    setupTabs(fields);

    vi.spyOn(fillApi, 'mapFields').mockResolvedValue({
      mappings: [
        {
          field_id: 'why_us',
          field_label: 'Why do you want to join us?',
          action: 'open_question',
          is_open_question: true,
          is_flagged: false,
        },
      ],
    });

    const result = await fillActivePage(profile);

    expect(result.filled.map((f) => f.name)).not.toContain('why_us');
    expect(result.openQuestions?.map((f) => f.name)).toContain('why_us');
  });

  it('fails soft when mapFields rejects: fills rule values and shows aiNotice', async () => {
    const fields = [
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'unknown_custom_field', label: 'Custom Info', type: 'text' },
    ];
    setupTabs(fields);

    vi.spyOn(fillApi, 'mapFields').mockRejectedValue(new Error('Network connection timeout'));

    const result = await fillActivePage(profile);

    // Rule-based field is filled
    expect(result.filled).toEqual([{ name: 'email', value: 'asha@example.test' }]);
    // AI notice is present explaining failure
    expect(result.aiNotice).toMatch(/AI field mapping failed.*Network connection timeout/);
  });
});

describe('Drafting and using answers in FillReview', () => {
  const sampleJob: Job = {
    id: 'job-123',
    title: 'Frontend Engineer',
    company: 'Acme Corp',
    location: 'Remote',
    remote: 'remote',
    description: 'We are hiring a frontend engineer.',
    url: 'https://example.com/job/123',
  };

  const sampleProfile: Profile = {
    name: 'Asha Rao',
    email: 'asha@example.test',
    phone: '',
    location: 'Pune',
    links: {},
    experience: [],
    education: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends drafted answer to the page only after clicking "Use this answer"', async () => {
    const sendMessageMock = vi.fn(async (_tab: number, message: any) => ({
      filled: Object.keys(message.values).map((name) => ({ name, value: message.values[name] })),
    }));
    (globalThis as any).chrome = {
      tabs: {
        query: vi.fn(async () => [{ id: 99, url: 'https://example.com' }]),
        sendMessage: sendMessageMock,
      },
    };

    const draftAnswerSpy = vi.spyOn(draftApi, 'draftAnswer').mockResolvedValue({
      draft: 'I love writing scalable web applications.',
      rewrite: 'I love writing scalable web applications.',
    } as any);

    render(
      <FillReview
        filled={[]}
        skipped={[]}
        openQuestions={[{ name: 'essay_why_us', label: 'Why do you want to work here?' }]}
        selectedJob={sampleJob}
        profile={sampleProfile}
        target={{ tabId: 99, frameId: 0 }}
      />
    );

    // Click "Draft answer"
    const draftButton = screen.getByRole('button', { name: /Draft answer/i });
    fireEvent.click(draftButton);

    await waitFor(() => {
      expect(draftAnswerSpy).toHaveBeenCalledTimes(1);
    });

    // The answer is drafted and displayed in textarea, but NOT sent to page yet
    const textarea = await screen.findByRole('textbox', { name: /Answer for Why do you want to work here\?/i });
    expect((textarea as HTMLTextAreaElement).value).toBe('I love writing scalable web applications.');
    expect(sendMessageMock).not.toHaveBeenCalled();

    // Now click "Use this answer"
    const useAnswerButton = screen.getByRole('button', { name: /Use this answer/i });
    fireEvent.click(useAnswerButton);

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(99, {
        type: 'FILL_REQUEST',
        jobId: 'page',
        values: {
          essay_why_us: 'I love writing scalable web applications.',
        },
      }, { frameId: 0 });
    });

    expect(screen.getByText('Answer filled on page!')).toBeDefined();
  });
});
