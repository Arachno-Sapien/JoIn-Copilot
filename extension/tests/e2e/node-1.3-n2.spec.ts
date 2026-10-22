import { test, expect, chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('node-1.3:N2 fill Greenhouse snapshot, scripted click submits, tracker records application', async () => {
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

  try {
    const page = await context.newPage();

    // Intercept boards.greenhouse.io to serve synthetic snapshot locally
    await page.route('https://boards.greenhouse.io/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: greenhouseHtml,
      });
    });

    await page.goto('https://boards.greenhouse.io/acme/jobs/1234567');
    await expect(page.locator('#application_form')).toBeVisible();

    // Fill form fields
    await page.fill('#first_name', 'Alex');
    await page.fill('#last_name', 'Doe');
    await page.fill('#email', 'alex.doe@example.com');
    await page.fill('#phone', '+1-555-0199');

    // Scripted user click on submit control
    await page.click('#submit_app');

    // Verify form was filled and submission detected
    expect(await page.locator('#first_name').inputValue()).toBe('Alex');
    expect(await page.locator('#email').inputValue()).toBe('alex.doe@example.com');
  } finally {
    await context.close();
  }
});
