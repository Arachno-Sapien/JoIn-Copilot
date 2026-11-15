import { defineContentScript } from 'wxt/sandbox';
import { contentScriptDefinition } from './config';
import { getAdapterForUrl } from '../../adapters';
import { PageFormDetectedMessage, FillResultMessage, FormField } from '../../lib/messaging';
import { verifyFields } from '../../lib/fill/verify';

export default defineContentScript({
  matches: contentScriptDefinition.matches,
  allFrames: contentScriptDefinition.allFrames,
  main() {
    // The side panel injects this script on sites outside the manifest; run once per page.
    const page = window as unknown as { __jobCopilotContent?: boolean };
    if (page.__jobCopilotContent) return;
    page.__jobCopilotContent = true;

    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
      const adapter = getAdapterForUrl(new URL(window.location.href));
      const send = (message: unknown) => {
        chrome.runtime.sendMessage(message).catch(() => {});
      };
      // Scan when asked, not once at load: many sites render their form later.
      const scan = () => {
        const root = adapter.findFormRoot(document);
        return { root, fields: root ? adapter.listFields(root) : [] };
      };

      const found = scan().fields;
      if (found.length > 0) {
        const detected: PageFormDetectedMessage = {
          type: 'PAGE_FORM_DETECTED',
          fields: found,
          url: window.location.href,
        };
        send(detected);
      }

      // Listens only; never submits. The tracker gets the page's job title with the answers.
      adapter.detectSubmission(document, (payload: any) => {
        const job = adapter.extractJob(document);
        send({
          ...payload,
          job: { title: job.title || document.title, company: job.company || window.location.hostname },
        });
      });

      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === 'LIST_FIELDS') {
          // A frame without fields stays silent so the frame holding the form answers.
          const { fields } = scan();
          if (fields.length > 0) sendResponse({ fields, url: window.location.href });
          return;
        }
        if (message?.type !== 'FILL_REQUEST') return;

        const { root, fields } = scan();
        if (!root || fields.length === 0) return;
        const values: Record<string, string> = message.values || {};
        const filled: Array<{ name: string; value: any }> = [];
        const skipped: FormField[] = [];
        const toVerify: Array<{ field: FormField; intendedValue: string }> = [];

        (async () => {
          for (const field of fields) {
            const key = field.name || field.id || '';
            const val = values[key];
            if (val === undefined || val === null) {
              skipped.push(field);
              continue;
            }
            if (await adapter.fillField(field, val)) {
              filled.push({ name: key, value: val });
              toVerify.push({ field, intendedValue: String(val) });
            } else {
              skipped.push(field);
            }
            // Paced: some forms validate on blur and misbehave when everything changes at once.
            await new Promise((r) => setTimeout(r, 10));
          }

          const verify = verifyFields(root, toVerify);
          const result: FillResultMessage = { type: 'FILL_RESULT', filled, skipped };
          send(result);
          sendResponse({ success: true, filled, skipped, verify });
        })();

        return true; // async sendResponse
      });
    } catch {
      // Ignore errors in content script execution
    }
  },
});
