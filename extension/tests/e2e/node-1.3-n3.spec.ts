import { test, expect, chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('node-1.3:N3 extension sends requests only to configured backend and local origins', async () => {
  const greenhouseHtml = readFileSync(
    resolve(__dirname, '../unit/fill/snapshots/greenhouse/application.html'),
    'utf8'
  );

  const pathToExtension = resolve(__dirname, '../../.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  const requestedUrls: string[] = [];

  context.on('request', (req) => {
    requestedUrls.push(req.url());
  });

  try {
    const page = await context.newPage();

    // Serve local greenhouse snapshot
    await page.route('https://boards.greenhouse.io/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: greenhouseHtml,
      });
    });

    await page.goto('https://boards.greenhouse.io/acme/jobs/1234567');
    await expect(page.locator('#application_form')).toBeVisible();

    await page.fill('#first_name', 'Alex');
    await page.fill('#email', 'alex.doe@example.com');
    await page.click('#submit_app');

    // Verify all requested URLs belong to allowed origins
    const allowedOriginPatterns = [
      /^https:\/\/boards\.greenhouse\.io\//,
      /^http:\/\/127\.0\.0\.1:8000\//,
      /^http:\/\/localhost:8000\//,
      /^chrome-extension:\/\//,
      /^data:/,
      /^about:/,
    ];

    for (const url of requestedUrls) {
      const isAllowed = allowedOriginPatterns.some((pattern) => pattern.test(url));
      expect(isAllowed, `Request URL not allowed: ${url}`).toBe(true);
    }
  } finally {
    await context.close();
  }
});
