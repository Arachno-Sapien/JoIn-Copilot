import { mapAllFields } from '../field-mapper';
import { FilledField, FormField } from '../messaging';
import { Profile } from '../schemas/profile';
import { BLOCKED_SITES, FORM_FRAME_HOSTS, NO_ACCESS_MESSAGE, OTHER_SITE_FRAME_MESSAGE, hostOf } from '../sites';
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
  target?: FormTarget;
}

/** Where the form is: a tab, and in it either a frame id or a frame's own token. */
export interface FormTarget {
  tabId: number;
  frameId?: number;
  frame?: string;
}

interface Listed {
  fields: FormField[];
  url?: string;
  frame?: string;
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

  // The top frame first. Another frame only if it is this site or a job site, so profile
  // data never goes to, say, an ad or newsletter frame from a third party.
  // ponytail: of several frames with forms, the first to answer is the one checked.
  const findForm = async () => {
    const top = await sendTo<Listed>({ tabId, frameId: 0 }, { type: 'LIST_FIELDS' });
    // The token too: if the tab moves on to another page, that page's script ignores the fill.
    if (top?.fields?.length) return { listed: top, target: { tabId, frameId: 0, frame: top.frame } as FormTarget };
    const framed = await sendTo<Listed>({ tabId }, { type: 'LIST_FIELDS' });
    if (!framed?.fields?.length) return undefined;
    if (!framed.frame || !isTrustedFrame(framed.url, tab.url)) throw new Error(OTHER_SITE_FRAME_MESSAGE);
    return { listed: framed, target: { tabId, frame: framed.frame } as FormTarget };
  };

  let form = await findForm();
  if (!form) {
    // The content script loads by itself only on the sites in the manifest. Elsewhere,
    // add it to this tab, which Chrome allows once the user clicked the toolbar icon here.
    const inject = (allFrames: boolean) =>
      chrome.scripting.executeScript({ target: { tabId, allFrames }, files: [CONTENT_SCRIPT] });
    await inject(true)
      .catch(() => inject(false))
      .catch(() => {
        throw new Error(NO_ACCESS_MESSAGE);
      });
    form = await findForm();
  }
  if (!form) throw new Error('No form fields found on this page.');
  const { listed, target } = form;

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

      // Only the fields we sent: the model cannot aim a value at a field we did not ask about.
      const fieldByName = new Map(leftoverFields.map((f) => [f.name, f]));

      for (const mapping of response.mappings) {
        const field = fieldByName.get(mapping.field_id);
        if (!field || values[field.name]) continue;

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
    return /\b(resume|cv|curriculum vitae)\b/.test(text);
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

  const reply = await sendTo<FillReply>(target, { type: 'FILL_REQUEST', jobId: 'page', values, files });
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
    target,
  };
}

/** Fills one approved answer into the frame that holds the form. True if the page took it. */
export async function fillAnswer(target: FormTarget, name: string, value: string): Promise<boolean> {
  const reply = await sendTo<FillReply>(target, { type: 'FILL_REQUEST', jobId: 'page', values: { [name]: value } });
  return !!reply?.filled?.some((f) => f.name === name);
}

function isTrustedFrame(frameUrl: string | undefined, tabUrl: string | undefined): boolean {
  try {
    const frame = new URL(frameUrl ?? '');
    return frame.origin === new URL(tabUrl ?? '').origin || FORM_FRAME_HOSTS.test(frame.hostname);
  } catch {
    return false;
  }
}

/** frameId picks a frame by Chrome's id; frame is the token a frame's content script answers to. */
function sendTo<T>(target: FormTarget, message: Record<string, unknown>): Promise<T | undefined> {
  const body = target.frame ? { ...message, frame: target.frame } : message;
  const sent =
    target.frameId === undefined
      ? chrome.tabs.sendMessage(target.tabId, body)
      : chrome.tabs.sendMessage(target.tabId, body, { frameId: target.frameId });
  return Promise.resolve(sent).catch(() => undefined);
}

