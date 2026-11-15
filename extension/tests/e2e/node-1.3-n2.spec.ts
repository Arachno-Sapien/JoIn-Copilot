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
    channel: 'chromium',
    headless: true,
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  try {
    // 4. Open job page
    const page = await context.newPage();

    // 2. Serve the snapshot & fulfill form submissions with 204
    await context.route('https://boards.greenhouse.io/**', (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        route.fulfill({ status: 204 });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: greenhouseHtml,
        });
      }
    });

    // 3. Answer backend calls. On the context, so the side panel's calls never reach a real backend.
    let mapFieldsCalls = 0;
    await context.route('http://127.0.0.1:8000/**', (route) => {
      const req = route.request();
      if (req.method() === 'POST' && req.url().includes('/fill/map-fields')) {
        mapFieldsCalls++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mappings: [] }),
        });
      } else {
        route.fulfill({ status: 404 });
      }
    });

    await page.goto('https://boards.greenhouse.io/acme/jobs/1234567');
    await expect(page.locator('#application_form')).toBeVisible();

    // 5. Find extension ID and open side panel
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    const extensionId = worker.url().split('/')[2];
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(panel.locator('body')).toBeVisible();

    // 6. Write synthetic profile into IndexedDB (raw API with no version number)
    await panel.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('JobCopilotDB');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('profile', 'readwrite');
          const store = tx.objectStore('profile');
          store.put({
            id: 'main',
            schema_version: 1,
            name: 'Asha Rao',
            email: 'asha@example.test',
            phone: '+91 90000 00000',
            location: 'Pune',
            links: {},
            education: [],
            experience: [],
            projects: [],
            skills: [],
            certifications: [],
            preferences: { locations: [], remote: 'any', job_types: [], avoid_keywords: [] },
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    });

    await panel.reload();
    await expect(panel.getByRole('button', { name: 'Fill & Review' })).toBeVisible();

    // 7. Make the job page the active tab
    await page.bringToFront();

    // 8. Fill from the panel
    await panel.getByRole('button', { name: 'Fill & Review' }).click();
    await page.bringToFront();
    await panel.getByRole('button', { name: 'Fill this page' }).click();
    await expect(panel.getByRole('heading', { name: 'Form Filling Review' })).toBeVisible();
    expect(mapFieldsCalls).toBe(1); // the leftover answer fields went to the mocked backend

    // 9. Check the page fields
    await expect(page.locator('#first_name')).toHaveValue('Asha');
    await expect(page.locator('#first_name')).toHaveAttribute('data-jc-filled', 'true');
    await expect(page.locator('#last_name')).toHaveValue('Rao');
    await expect(page.locator('#last_name')).toHaveAttribute('data-jc-filled', 'true');
    await expect(page.locator('#email')).toHaveValue('asha@example.test');
    await expect(page.locator('#email')).toHaveAttribute('data-jc-filled', 'true');

    // 10. Submit as the user
    await page.click('#submit_app');

    // 11. Check the tracker in IndexedDB
    const app = await panel.evaluate(async () => {
      const start = Date.now();
      while (Date.now() - start < 5000) {
        const rows = await new Promise<any[]>((resolve, reject) => {
          const req = indexedDB.open('JobCopilotDB');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('applications', 'readonly');
            const store = tx.objectStore('applications');
            const getReq = store.getAll();
            getReq.onsuccess = () => {
              db.close();
              resolve(getReq.result);
            };
            getReq.onerror = () => {
              db.close();
              reject(getReq.error);
            };
          };
        });
        if (rows && rows.length === 1) {
          return rows[0];
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return null;
    });

    expect(app).not.toBeNull();
    expect(app.status).toBe('applied');
    expect(app.job_snapshot?.url).toBe('https://boards.greenhouse.io/acme/jobs/1234567');
  } finally {
    await context.close();
  }
});
