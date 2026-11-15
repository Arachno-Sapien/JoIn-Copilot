import { mapAllFields } from '../field-mapper';
import { FilledField, FormField } from '../messaging';
import { Profile } from '../schemas/profile';
import { BLOCKED_SITES, NO_ACCESS_MESSAGE, hostOf } from '../sites';
import type { VerificationResult } from './verify';

// Where WXT builds entrypoints/content/index.ts.
const CONTENT_SCRIPT = 'content-scripts/content.js';

export interface PageFillResult {
  filled: FilledField[];
  skipped: FormField[];
}

interface FillReply extends PageFillResult {
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

  // Messages carry text only, so the resume file is left for the user to attach.
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(mapAllFields(listed.fields, profile))) {
    if (typeof value === 'string' && value) values[name] = value;
  }

  const reply = await ask<FillReply>({ type: 'FILL_REQUEST', jobId: 'page', values });
  if (!reply) throw new Error('The page did not answer. Reload it and try again.');

  // A field the page emptied again was not really filled.
  const rejected = reply.verify.mismatches.filter((m) => m.status === 'rejected').map((m) => m.field);
  const rejectedNames = new Set(rejected.map((f) => f.name));
  return {
    filled: reply.filled.filter((f) => !rejectedNames.has(f.name)),
    skipped: [...reply.skipped, ...rejected],
  };
}
