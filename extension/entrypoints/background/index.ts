import { defineBackground } from 'wxt/sandbox';
import { setupSidePanelBehavior } from './sidepanel';
import { handleApplicationSubmitted, handleTrackerAlarm } from '../../lib/tracker';
import { syncGmail } from '../../lib/gmail';
import { testConnection } from '../../lib/ai/bharatcode';

export default defineBackground(() => {
  // Configure side panel to open on action click
  setupSidePanelBehavior().catch((err) => {
    console.error('Failed to setup side panel behavior:', err);
  });

  // Background message listener for extension messaging
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'PAGE_FORM_DETECTED') {
        // Form detected on page
      } else if (message?.type === 'APPLICATION_SUBMITTED') {
        handleApplicationSubmitted(message)
          .then((app) => sendResponse({ success: true, application: app }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      } else if (message?.type === 'BHARATCODE_TEST_CONNECTION') {
        testConnection().then(sendResponse);
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
    chrome.alarms.create('keepalive_or_sync', { periodInMinutes: 60 });
    chrome.alarms.create('no_response_sweep', { periodInMinutes: 60 * 24 });
    chrome.alarms.create('gmail_sync', { periodInMinutes: 180 });

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
