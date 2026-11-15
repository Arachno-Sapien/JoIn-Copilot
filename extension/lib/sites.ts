// Project rule 5: never read LinkedIn or Naukri pages.
export const BLOCKED_SITES = /(^|\.)(linkedin\.com|naukri\.com)$/;

// Job sites whose application form other sites embed in a frame (Greenhouse, for one).
export const FORM_FRAME_HOSTS = /(^|\.)(greenhouse\.io|lever\.co|internshala\.com|unstop\.com)$/;

export const OTHER_SITE_FRAME_MESSAGE =
  "The form on this page comes from another site, so Job Copilot won't fill it. Fill it in yourself.";

export const NO_ACCESS_MESSAGE =
  "Job Copilot can't reach this page yet. Click the Job Copilot icon in Chrome's toolbar while this page is open, then try again.";

export function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? '').hostname;
  } catch {
    return '';
  }
}
