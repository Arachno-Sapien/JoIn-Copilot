// Project rule 5: never read LinkedIn or Naukri pages.
export const BLOCKED_SITES = /(^|\.)(linkedin\.com|naukri\.com)$/;

export const NO_ACCESS_MESSAGE =
  "Job Copilot can't reach this page yet. Click the Job Copilot icon in Chrome's toolbar while this page is open, then try again.";

export function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? '').hostname;
  } catch {
    return '';
  }
}
