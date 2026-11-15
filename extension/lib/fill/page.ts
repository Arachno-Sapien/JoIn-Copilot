import { mapAllFields } from '../field-mapper';
import { FilledField, FormField } from '../messaging';
import { Profile } from '../schemas/profile';
import { BLOCKED_SITES, NO_ACCESS_MESSAGE, hostOf } from '../sites';
import { mapFields } from '../api/fill';
import { apiClient } from '../api/client';
import { db } from '../db';
import type { VerificationResult } from './verify';

// Where WXT builds entrypoints/content/index.ts.
const CONTENT_SCRIPT = 'content-scripts/content.js';

export interface PageFillResult {
  filled: FilledField[];
  skipped: FormField[];
  openQuestions?: FormField[];
  aiNotice?: string;
}

interface FillReply {
  filled: FilledField[];
  skipped: FormField[];
  verify: VerificationResult;
}

/**
 * Fills the form on the active tab from the saved profile and reports what was filled
 * and what was left for the user. Runs in the side panel. It never submits anything.
 */
export async function fillActivePage(profile: Profile): Promise<PageFillResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active browser tab found');
  const tabId = tab.id;
  if (BLOCKED_SITES.test(hostOf(tab.url))) {
    throw new Error(
      "Job Copilot doesn't read or fill LinkedIn or Naukri pages. After you apply there, add it under Tracker with Track application."
    );
  }

  // ponytail: with several frames holding forms, the first frame to answer wins.
  const ask = <T>(message: unknown): Promise<T | undefined> =>
    chrome.tabs.sendMessage(tabId, message).catch(() => undefined);

  let listed = await ask<{ fields: FormField[] }>({ type: 'LIST_FIELDS' });
  if (!listed) {
    // The content script loads by itself only on the sites in the manifest. Elsewhere,
    // add it to this tab, which Chrome allows once the user clicked the toolbar icon here.
    const inject = (allFrames: boolean) =>
      chrome.scripting.executeScript({ target: { tabId, allFrames }, files: [CONTENT_SCRIPT] });
    await inject(true)
      .catch(() => inject(false))
      .catch(() => {
        throw new Error(NO_ACCESS_MESSAGE);
      });
    listed = await ask<{ fields: FormField[] }>({ type: 'LIST_FIELDS' });
  }
  if (!listed?.fields?.length) throw new Error('No form fields found on this page.');

  // 1. Run local rules first
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(mapAllFields(listed.fields, profile))) {
    if (typeof value === 'string' && value) values[name] = value;
  }

  // 2. Leftover fields for AI mapping
  const excludedTypes = new Set(['file', 'password', 'checkbox', 'radio', 'hidden']);
  const leftoverFields = listed.fields.filter((field) => {
    if (values[field.name]) return false;
    const type = (field.type || 'text').toLowerCase();
    if (excludedTypes.has(type)) return false;
    if (field.manual) return false;
    return true;
  });

  let aiNotice: string | undefined;
  const openQuestions: FormField[] = [];
  const aiSkippedFields: FormField[] = [];

  if (leftoverFields.length > 0) {
    try {
      const response = await mapFields(apiClient, {
        profile,
        fields: leftoverFields.map((field) => ({
          id: field.name,
          label: field.label || field.placeholder || field.name,
          type: field.type || 'text',
          options: field.options,
        })),
      });

      const fieldByName = new Map(listed.fields.map((f) => [f.name, f]));

      for (const mapping of response.mappings) {
        const field = fieldByName.get(mapping.field_id);
        if (!field) continue;

        if (mapping.is_flagged) {
          aiSkippedFields.push({
            ...field,
            reason: mapping.flag_reason || 'Flagged by safety check',
          });
        } else if (mapping.action === 'open_question' || mapping.is_open_question) {
          // Checked before 'fill': model-written prose is filled only after the user approves it.
          openQuestions.push(field);
        } else if (mapping.action === 'fill' && mapping.value && typeof mapping.value === 'string') {
          values[mapping.field_id] = mapping.value;
        } else if (mapping.action === 'skip') {
          aiSkippedFields.push(field);
        }
      }
    } catch (err: any) {
      aiNotice = `AI field mapping failed: ${err?.message || 'backend unavailable'}`;
    }
  }

  // 3. Attach resume if any file input mentions resume or CV
  const files: Record<string, { name: string; type: string; base64: string }> = {};
  const resumeFields = listed.fields.filter((f) => {
    if (f.type !== 'file') return false;
    const text = `${f.name} ${f.label || ''} ${f.placeholder || ''}`.toLowerCase();
    return text.includes('resume') || text.includes('cv');
  });

  if (resumeFields.length > 0) {
    try {
      const resumes = await db.resumes.toArray();
      if (resumes.length > 0) {
        resumes.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        const newest = resumes[0];
        const buffer = await newest.data.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        for (const rf of resumeFields) {
          files[rf.name] = {
            name: newest.filename,
            type: newest.data.type || 'application/pdf',
            base64,
          };
        }
      }
    } catch {
      // Fail soft
    }
  }

  const reply = await ask<FillReply>({ type: 'FILL_REQUEST', jobId: 'page', values, files });
  if (!reply) throw new Error('The page did not answer. Reload it and try again.');

  // A field the page emptied again was not really filled.
  const rejected = reply.verify.mismatches.filter((m) => m.status === 'rejected').map((m) => m.field);
  const rejectedNames = new Set(rejected.map((f) => f.name));
  const openQuestionNames = new Set(openQuestions.map((f) => f.name));
  const aiSkippedByName = new Map(aiSkippedFields.map((f) => [f.name, f]));

  const mergedSkipped = [
    ...reply.skipped.filter((f) => !openQuestionNames.has(f.name)).map((f) => aiSkippedByName.get(f.name) || f),
    ...rejected,
  ];

  return {
    filled: reply.filled.filter((f) => !rejectedNames.has(f.name)),
    skipped: mergedSkipped,
    openQuestions,
    aiNotice,
  };
}

