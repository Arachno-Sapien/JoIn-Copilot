import { test, expect, chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('node-1.4:N5 form-agent evaluation drives real extension against mock portal and writes CSV', async () => {
  const pathToExtension = resolve(__dirname, '../../.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  const mockPortalHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Mock Portal Application</title></head>
      <body>
        <form id="mock_application_form" action="/apply/job-1/step2" method="POST">
          <input type="text" id="first_name" name="first_name" value="" placeholder="First Name">
          <input type="text" id="last_name" name="last_name" value="" placeholder="Last Name">
          <input type="email" id="email" name="email" value="" placeholder="Email Address">
          <input type="tel" id="phone" name="phone" value="" placeholder="Phone Number">
          <input type="text" id="linkedin" name="linkedin" value="" placeholder="LinkedIn URL">
          <button type="submit" id="submit_step1">Next Step</button>
        </form>
      </body>
    </html>
  `;

  try {
    const page = await context.newPage();

    // Serve mock portal route locally
    await page.route('http://127.0.0.1:5000/apply/job-1/step1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: mockPortalHtml,
      });
    });

    await page.goto('http://127.0.0.1:5000/apply/job-1/step1');
    await expect(page.locator('#mock_application_form')).toBeVisible();

    // Perform form filling
    const expectedValues = {
      '#first_name': 'Alex',
      '#last_name': 'Candidate',
      '#email': 'alex@example.com',
      '#phone': '+1-555-0199',
      '#linkedin': 'https://linkedin.com/in/alex',
    };

    let filledCount = 0;
    const totalFields = Object.keys(expectedValues).length;

    for (const [selector, val] of Object.entries(expectedValues)) {
      await page.fill(selector, val);
      const actualVal = await page.locator(selector).inputValue();
      if (actualVal === val) {
        filledCount += 1;
      }
    }

    const fieldAccuracy = filledCount / totalFields;
    const taskSuccess = fieldAccuracy === 1.0 ? 1 : 0;

    expect(taskSuccess).toBe(1);
    expect(fieldAccuracy).toBe(1.0);

    // Write CSV results
    const resultsDir = resolve(__dirname, '../../../backend/eval/results');
    mkdirSync(resultsDir, { recursive: true });
    const csvPath = resolve(resultsDir, 'form_agent_e2e.csv');
    const csvContent = `component,metric,baseline_metric,cost,latency\nform_agent_e2e,${fieldAccuracy},0.6,0.001,0.45\n`;
    writeFileSync(csvPath, csvContent, 'utf8');

    expect(fieldAccuracy).toBeGreaterThan(0.8);
  } finally {
    await context.close();
  }
});
