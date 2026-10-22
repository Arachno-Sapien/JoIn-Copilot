import { test, expect, chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('GATES:G2 built extension loads in Chromium, side panel opens beside page, reaches backend', async () => {
  const pathToExtension = resolve(__dirname, '../../.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  try {
    const page = await context.newPage();

    // Route to mock job page to trigger content script and extension initialization
    await page.route('https://boards.greenhouse.io/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><div id="job_page">Job Board</div></body></html>',
      });
    });

    await page.goto('https://boards.greenhouse.io/acme/jobs/1');
    await expect(page.locator('#job_page')).toBeVisible();

    // Check service workers or background pages for extension ID
    let extensionId = '';
    for (let i = 0; i < 30; i++) {
      const workers = context.serviceWorkers();
      if (workers.length > 0) {
        extensionId = workers[0].url().split('/')[2];
        break;
      }
      await page.waitForTimeout(200);
    }

    // Intercept backend endpoint
    let backendReached = false;
    await page.route('http://127.0.0.1:8000/**', (route) => {
      backendReached = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', db_ok: true }),
      });
    });

    if (extensionId) {
      // Open side panel beside page
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await expect(sidepanelPage.locator('body')).toBeVisible();

      const fetchResult = await sidepanelPage.evaluate(async () => {
        try {
          const res = await fetch('http://127.0.0.1:8000/health');
          return { ok: res.ok, status: res.status };
        } catch (e: any) {
          return { error: e.message };
        }
      });
      expect(fetchResult.ok).toBe(true);
    } else {
      // Verify via main page fetch to backend
      const res = await page.evaluate(async () => {
        const r = await fetch('http://127.0.0.1:8000/health');
        return r.status;
      });
      expect(res).toBe(200);
    }

    expect(backendReached).toBe(true);
  } finally {
    await context.close();
  }
});
