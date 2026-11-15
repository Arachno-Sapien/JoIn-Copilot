import { defineBackground } from 'wxt/sandbox';
import { ensureAlarm, setupSidePanelBehavior } from './sidepanel';
import { handleApplicationSubmitted, handleTrackerAlarm } from '../../lib/tracker';
import { syncGmail } from '../../lib/gmail';
import { hideStorageFromContentScripts } from '../../lib/ai/provider';

export default defineBackground(() => {
  // Configure side panel to open on action click
  setupSidePanelBehavior().catch((err) => {
    console.error('Failed to setup side panel behavior:', err);
  });

  hideStorageFromContentScripts().catch((err) => {
    console.error('Failed to restrict storage to extension pages:', err);
  });

  // Background message listener for extension messaging
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'PAGE_FORM_DETECTED') {
        // Form detected on page
      } else if (message?.type === 'APPLICATION_SUBMITTED') {
        handleApplicationSubmitted(message, { job: message.job })
          .then((app) => sendResponse({ success: true, application: app }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      } else if (message?.type === 'SYNC_GMAIL_MANUAL') {
        syncGmail()
          .then((result) => sendResponse({ success: true, result }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      }
    });
  }

  // Periodic alarms-based scheduler (MV3 compliant, never setInterval)
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    ensureAlarm('no_response_sweep', 60 * 24).catch(() => {});
    ensureAlarm('gmail_sync', 180).catch(() => {});

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'no_response_sweep') {
        handleTrackerAlarm(alarm).catch((err) => {
          console.error('Failed no_response_sweep alarm:', err);
        });
      } else if (alarm.name === 'gmail_sync') {
        syncGmail().catch((err) => {
          console.error('Failed gmail_sync alarm:', err);
        });
      }
    });
  }
});
