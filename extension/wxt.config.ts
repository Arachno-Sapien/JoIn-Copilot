import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: [],
  // A function, so WXT has loaded extension/.env into import.meta.env before this runs.
  manifest: () => ({
    name: 'Job Copilot',
    description: 'AI Job Search Copilot Extension',
    version: '0.1.0',
    manifest_version: 3,
    permissions: [
      'sidePanel',
      'storage',
      'alarms',
      'activeTab',
      'scripting',
      'identity',
    ],
    host_permissions: [
      'https://boards.greenhouse.io/*',
      'https://job-boards.greenhouse.io/*',
      'https://jobs.lever.co/*',
      'https://internshala.com/*',
      'https://unstop.com/*',
      'https://gmail.googleapis.com/*',
      'https://www.googleapis.com/*',
    ],
    oauth2: {
      client_id:
        (import.meta as any).env?.WXT_GOOGLE_CLIENT_ID ||
        process.env.WXT_GOOGLE_CLIENT_ID ||
        'dummy-client-id.apps.googleusercontent.com',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
    action: {
      default_title: 'Open Job Copilot',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  }),
});
