# Handoff: Task H, the end-to-end proof

Updated on 2026-11-15. Tasks A to G and I from the first version of this file are built and merged (commit `064dcb1`), and reviewed, with the fixes in `33b2fb4`, `253fb0d` and `0c86318`. One task is left: **Task H**, which makes the end-to-end test prove the real flow.

**Status: Task H is done** (2026-11-15). The test is rewritten, both deliberate-failure checks fail as they should, and the routes are on the browser context, so the side panel's backend calls are mocked too. Still with the owner: the three `.unlazy/**` steps in 4.4.

Read this whole file once before you start. Section 4 is the task.

## 0. Approval

Task H edits a driver-owned file, `extension/tests/e2e/node-1.3-n2.spec.ts`. The owner asked for this handoff on 2026-11-15, which approves rewriting that one file. It does not approve anything under `.unlazy/**`: step 4.4 lists what you ask the owner to do there.

Change no other driver-owned path. Driver-owned paths: `scripts/gates/**`, `backend/tests/acceptance/**`, `extension/tests/acceptance/**`, `extension/tests/integration/**`, `extension/tests/e2e/**`, `docs/design.md`, `docs/implementation-plan.md` and `.unlazy/**`.

## 1. Rules

These come from `.agents/rules/job-copilot.md`. Read that file too. The ones that matter here:

1. **Never submit a form for the user.** That means no `form.submit()`, no `requestSubmit()`, no click on a submit control and no synthetic submit event in extension code. A Playwright click in a test stands in for the user and is allowed. The `no-auto-submit` oracle checks extension source, not tests.
2. **Do not change the extension to make the test pass.** If the flow cannot be driven as written in section 4, stop and report what you saw (step 4.3). Do not add a test-only code path, flag or message to the extension.
3. **Tests never call a live model, job API or Gmail.** Serve pages with `page.route` and answer backend calls with routes too.
4. **Fixtures hold synthetic data only** (`asha@example.test`, never a real person).
5. **Never weaken a test, gate or oracle.** The new test must fail when the feature is broken (step 4.2).
6. **Toolchain:** Node 22 and npm. Conventional commit messages, for example `test(e2e): drive fill and tracking through the side panel`.

## 2. Checks to run before calling the task done

From `extension/`, build first: the end-to-end tests load `extension/.output/chrome-mv3`.

```bash
npm run build
```

```bash
npx tsc --noEmit
```

```bash
npx vitest run
```

```bash
npx playwright test
```

From `backend/`:

```bash
uv run --locked ruff check app tests
```

```bash
uv run --locked pytest tests -q
```

The backend test run rewrites `backend/tests/snapshots/jobs_extract.json`. Do not commit that change.

From the repository root (each must print `ORACLE OK`, and the last `SELFTEST OK`):

```bash
node scripts/gates/oracles.mjs extension-build
```

```bash
node scripts/gates/oracles.mjs no-auto-submit
```

```bash
node scripts/gates/oracles.mjs no-keys-in-extension
```

```bash
node scripts/gates/oracles.mjs non-goals
```

```bash
node scripts/gates/selftest.mjs
```

Baseline on 2026-11-15 after `0c86318`: 211 backend tests, 178 extension tests in 65 files, 4 Playwright tests, all passing.

## 3. How the real flow works (read before writing the test)

| Step | Where | What happens |
| --- | --- | --- |
| Profile | `extension/lib/db.ts` | Dexie database `JobCopilotDB`, version 3. The profile is row `'main'` in table `profile`. Applications are in table `applications` |
| Panel loads | `extension/entrypoints/sidepanel/App.tsx` | Reads the profile on mount. Tabs are buttons named `Profile`, `Jobs`, `Draft`, `Fill & Review` and `Tracker` |
| Fill | `extension/components/sidepanel/FillPage.tsx` | Button `Fill this page` calls `fillActivePage(profile)` |
| Find the form | `extension/lib/fill/page.ts` | `chrome.tabs.query({ active: true, currentWindow: true })`, then `LIST_FIELDS` to the top frame (`frameId: 0`). Another frame is used only if it is the same site as the tab or a known job site (`FORM_FRAME_HOSTS` in `extension/lib/sites.ts`) |
| Map values | `extension/lib/field-mapper.ts` | Local rules first. `first_name` gets the first word of `profile.name`, `last_name` the rest, plus `email` and `phone` |
| AI mapping | `page.ts` → `POST /fill/map-fields` | Only for leftover text fields. If the backend call fails, the fill goes on with the local values and shows a notice |
| Fill | `extension/entrypoints/content/index.ts` | `FILL_REQUEST` with `values` and the frame's token. Each filled field gets `data-jc-filled="true"` (`highlightField` in `extension/lib/fill/engine.ts`) |
| Submit | `extension/lib/fill/submission.ts` | The Greenhouse adapter listens for the user's click on the submit control inside the form, then sends `APPLICATION_SUBMITTED` with `url: window.location.href` |
| Track | `extension/entrypoints/background/index.ts` → `extension/lib/tracker.ts` | `handleApplicationSubmitted` writes a row to `applications` with `status: 'applied'` and `job_snapshot.url` |

The Greenhouse snapshot is `extension/tests/unit/fill/snapshots/greenhouse/application.html`. Its form is `#application_form`, which posts to `/jobs/1234567/applications`. The fields are `#first_name`, `#last_name`, `#email`, `#phone`, `#resume` (a file input), two optional text answers, and the submit control `#submit_app`.

## 4. Task H: rewrite `node-1.3-n2.spec.ts`

### Current state

- The test is named "fill Greenhouse snapshot, scripted click submits, tracker records application". It fills the form with Playwright's own `page.fill`, never opens the side panel and never checks the tracker. It passes without the feature existing.
- Gate N5 in `.unlazy/job-copilot/gates/node-1.3.md` records a manual review of the fill, review, submit and track flow. That flow did not exist in the side panel when the evidence was written.

### 4.1 Build

Keep the test name, because gate N2 runs this file by path. Copy the setup from the current file and from `extension/tests/e2e/root-g2.spec.ts`, which already finds the extension ID and opens the panel page.

1. **Launch** the built extension with `chromium.launchPersistentContext`, as the current test does.
2. **Serve the snapshot.** With `context.route('https://boards.greenhouse.io/**', ...)`, answer `GET` with the snapshot HTML. Answer the form's `POST` to `/jobs/1234567/applications` with status `204`, so the page stays put after the click instead of navigating.
3. **Answer the backend.** With `context.route('http://127.0.0.1:8000/**', ...)`, answer `POST /fill/map-fields` with `{"mappings": []}`, and anything else with 404. If extension pages turn out not to go through `context.route`, leave it: the fill still works with local rules (section 3, AI mapping).
4. **Open the job page:** `page.goto('https://boards.greenhouse.io/acme/jobs/1234567')`, then wait for `#application_form`.
5. **Find the extension ID** from `context.serviceWorkers()` (wait for the `serviceworker` event if the list is empty). Open `chrome-extension://<id>/sidepanel.html` in a second page, `panel`.
6. **Write the profile.** Dexie creates the database when the panel loads, so do this after step 5. In `panel.evaluate`, open `JobCopilotDB` with the raw `indexedDB.open('JobCopilotDB')` and **no version number**. Dexie stores version 3 as 30, so a hard-coded version fails. Put this row in the `profile` store, then `panel.reload()`:

   ```js
   {
     id: 'main', schema_version: 1, name: 'Asha Rao', email: 'asha@example.test',
     phone: '+91 90000 00000', location: 'Pune', links: {}, education: [], experience: [],
     projects: [], skills: [], certifications: [],
     preferences: { locations: [], remote: 'any', job_types: [], avoid_keywords: [] },
   }
   ```

7. **Make the job page the active tab:** `page.bringToFront()`. Do not bring `panel` to the front after this, or the panel becomes the active tab. Clicking in `panel` with Playwright does not bring it to the front.
8. **Fill from the panel:** click the `Fill & Review` button in `panel`, then `Fill this page`. Wait for the heading "Form Filling Review" in `panel`.
9. **Check the page:** `#first_name` is `Asha`, `#last_name` is `Rao`, `#email` is `asha@example.test`, and each has `data-jc-filled="true"`.
10. **Submit as the user:** `page.click('#submit_app')`.
11. **Check the tracker:** in `panel`, poll IndexedDB (raw API again, about 5 seconds at most) until the `applications` store has exactly one row. Assert its `status` is `applied` and its `job_snapshot.url` is `https://boards.greenhouse.io/acme/jobs/1234567`.
12. Close the context in `finally`, as the current test does.

### 4.2 Prove the test can fail

Run each of these once, confirm `npx playwright test tests/e2e/node-1.3-n2.spec.ts` fails, then undo the change with `git checkout -- <file>` and rebuild. Do not commit them.

- In `extension/lib/fill/page.ts`, make `fillActivePage` throw at its first line. The check in step 9 must fail.
- In `extension/entrypoints/background/index.ts`, skip the `handleApplicationSubmitted` call. The check in step 11 must fail.

Report both results.

### 4.3 Traps

- **The active tab.** If `chrome.tabs.query({ active: true, currentWindow: true })` from the panel page returns the panel's own tab, the fill reports "No form fields found on this page" or a missing-access message. Try `page.bringToFront()` again just before the click in step 8. If it still happens, stop and report it. Do not change the extension.
- **Headless mode.** Keep `--headless=new`, as in the other end-to-end tests. Old headless mode does not load extensions.
- **Build first.** The test reads `extension/.output/chrome-mv3`. A stale build tests old code.
- **The resume field.** `#resume` is required, but there is no resume in the database, so it is reported as skipped. That is expected. Do not assert on it.
- **No sleeps.** Wait on locators and poll the database. Do not use fixed `waitForTimeout` delays.

### 4.4 Ask the owner (`.unlazy/**` is theirs)

When the test passes and both checks in 4.2 fail as expected, ask the owner to:

1. Record contract revision 6 in `.unlazy/job-copilot/PLAN.md`: gate node-1.3:N2 now drives the side panel and the tracker.
2. Replace the N5 evidence in `.unlazy/job-copilot/gates/node-1.3.md` with a new manual review of the flow in a real Chrome window.
3. Re-run the node ledger:

   ```bash
   node .agents/skills/unlazy/scripts/gate-check.mjs --root . --cwd . --timeout 3600 --reverify .unlazy/job-copilot/gates/node-1.3.md
   ```

Only the owner approves gate checks.

### 4.5 Done when

- `extension/tests/e2e/node-1.3-n2.spec.ts` is the only file changed.
- Every check in section 2 passes, with the same test counts as the baseline.
- Both checks in 4.2 failed as expected.
- You told the owner what to do under 4.4.

## 5. Not part of this handoff

- **Provider allowlist.** When `JC_LLM_BASE_URLS` is empty, the backend allows only https providers on the internet and providers on the same machine (`backend/app/llm/provider.py`). Do not loosen this.
- **Plan entries for tasks A to G and I.** They were built without plan nodes. Adding them to `PLAN.md` is the owner's call.
- **Known limits, left on purpose:**
  - Every search embeds every cached job again. Cache the job vectors when the cache grows past a few hundred jobs.
  - Find jobs without a profile scores jobs against an empty profile.
  - The provider check resolves the host name once, and httpx resolves it again, so DNS rebinding can get past it. A shared backend must set `JC_LLM_BASE_URLS`.
- **New job sites.** Internshala and Unstop use the generic adapter. A site-specific adapter follows the `site-adapter` skill and needs a saved page snapshot first.
- **Non-goals in `docs/design.md`:** Workday, backend user accounts, stored credentials and scraping.

## 6. When you finish

Report plainly:

- what you changed
- the exact test counts
- the results of both checks in 4.2
- anything you could not verify, such as behaviour in a real Chrome window

Do not claim the flow was reviewed by hand unless you ran it in a real Chrome window yourself.
