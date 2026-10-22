import { defineContentScript } from 'wxt/sandbox';
import { contentScriptDefinition } from './config';
import { getAdapterForUrl } from '../../adapters';
import { PageFormDetectedMessage, FillResultMessage, FormField } from '../../lib/messaging';
import { verifyFields } from '../../lib/fill/verify';

export default defineContentScript({
  matches: contentScriptDefinition.matches,
  allFrames: contentScriptDefinition.allFrames,
  main() {
    try {
      const url = new URL(window.location.href);
      const adapter = getAdapterForUrl(url);
      if (!adapter) return;

      const formRoot = adapter.findFormRoot(document);
      if (!formRoot) return;

      const fields = adapter.listFields(formRoot);
      if (fields.length === 0) return;

      // Notify background that a form was detected
      const detectedMsg: PageFormDetectedMessage = {
        type: 'PAGE_FORM_DETECTED',
        fields,
        url: window.location.href,
      };

      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(detectedMsg).catch(() => {});
      }

      // Setup submission detection
      adapter.detectSubmission(formRoot, (payload: any) => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage(payload).catch(() => {});
        }
      });

      // Listen for FILL_REQUEST from background
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
          if (message?.type === 'FILL_REQUEST') {
            const values: Record<string, string> = message.values || {};
            const filledList: Array<{ name: string; value: any }> = [];
            const skippedList: FormField[] = [];
            const fieldsToVerify: Array<{ field: FormField; intendedValue: string }> = [];

            // Paced fill
            (async () => {
              for (const field of fields) {
                const key = field.name || field.id || '';
                const val = values[key];
                if (val !== undefined && val !== null) {
                  const success = await adapter.fillField(field, val);
                  if (success) {
                    filledList.push({ name: key, value: val });
                    fieldsToVerify.push({ field, intendedValue: String(val) });
                  } else {
                    skippedList.push(field);
                  }
                  // Small pacing delay
                  await new Promise((r) => setTimeout(r, 10));
                } else {
                  skippedList.push(field);
                }
              }

              // Verify pass
              const verifyResult = verifyFields(formRoot, fieldsToVerify);

              const fillResultMsg: FillResultMessage = {
                type: 'FILL_RESULT',
                filled: filledList,
                skipped: skippedList,
              };

              if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage(fillResultMsg).catch(() => {});
              }
              sendResponse({ success: true, verify: verifyResult });
            })();

            return true; // async sendResponse
          }
        });
      }
    } catch {
      // Ignore errors in content script execution
    }
  },
});
