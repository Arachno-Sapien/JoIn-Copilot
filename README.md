# Job Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Chrome extension that turns your resume into a structured profile, finds and ranks jobs that fit it, drafts application answers it checks against your resume, and tracks every application. All AI features run on the [BharatCode](https://bharatcode.ai/build) API with your own key.

Built for the BharatCode Build League hackathon. It is still under development: see [What works today](#what-works-today).

## Screenshots and demo

> Screenshots and a demo GIF go here.

## What it does

- Turns a PDF resume into a structured profile you can review and edit. Each bullet gets a stable id, so later checks can point to it.
- Ranks cached jobs against your profile. The model lists which required skills you have and which you're missing, and code turns those facts into the fit score.
- Drafts answers to application questions, splits each draft into claims and checks every claim against your resume. Anything your resume doesn't back up is flagged.
- Records an application when you submit a Greenhouse or Lever form and tracks its status. Applications with no reply for 28 days are marked as no response. With Gmail connected (read-only), recruiter emails update the status.
- Warns about postings that look like scams or that contain text trying to give the AI instructions.

The extension never submits an application for you. It fills in fields, and you review them and click submit.

## What works today

| Feature | Status |
|---|---|
| Resume parsing and profile editing | Works from the side panel |
| Adding a job from the current page | Works from the side panel |
| Application tracker and dashboard | Works; records come from submissions on Greenhouse and Lever pages |
| Gmail status updates | Needs a real Google OAuth client ID in `extension/wxt.config.ts` |
| Job matching, drafting, form filling, scam check | Backend endpoints work; the side panel does not call them yet |

## Install

You need Node 22, npm, Python 3.12 and [uv](https://docs.astral.sh/uv/). Docker is optional. The [setup guide](docs/guide/setup.md) walks through each step in more detail.

1. Start the backend from the repository root:

   ```bash
   cp .env.example .env
   cd backend
   uv sync
   uv run uvicorn app.main:app --port 8000
   ```

   Or run `docker compose up -d backend` from the repository root.

2. In a second terminal, build the extension from the repository root:

   ```bash
   cd extension
   npm install
   npm run build
   ```

3. Load it in Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `extension/.output/chrome-mv3`.
4. Right-click the Job Copilot icon and choose **Options**. Paste your BharatCode key, click **Store key**, then **Test connection**. If your backend is not at `http://127.0.0.1:8000`, change **Backend URL** on the same page and click **Save Settings**.
5. Click the toolbar icon to open the side panel.

## Get a BharatCode API key

Sign in at [bharatcode.ai/account](https://bharatcode.ai/account) and create a key. Students get free access after verifying an `.ac.in` or `.edu.in` email, and the Lite and Pro plans also include API access. Until your access is active, AI requests fail with a message that says how to get it.

If no key is saved, the side panel shows how to get one, and AI requests return a "key missing" message instead of failing silently.

## Model and endpoints

Every feature uses the model `qwen-3.8-27b` at `https://bharatcode.ai/api/model/v1`, sending your key as `Authorization: Bearer <your key>`.

- Generation uses `POST /responses` with `store: false`, so each call is stateless and resends its full context. Anything the code reads back, such as fit facts and claim verdicts, comes back as structured output (`text.format` with a JSON schema).
- Test connection on the options page calls `GET /models`, then sends a 16-token `POST /responses`. BharatCode answers `GET /models` for any key, so only the model call proves that the key and its plan work.
- Output budgets are 8,000 tokens for resume parsing, 4,000 for drafts and rewrites, and 2,000 for everything else. Reasoning effort is `none` except for drafting, rewriting and claim judging.

When a call fails:

- A cut-off answer is reported, never parsed and never retried with the same budget.
- A `503` is retried after 2, 4 and 8 seconds, then shown as "BharatCode is busy, try again".
- A `402` means the account has no API access yet, and the message says how to get it.
- The backend logs the `x-request-id` header when BharatCode sends one.

All model calls go through one module, [`backend/app/llm/bharatcode.py`](backend/app/llm/bharatcode.py). In the extension, the side panel and options page send your key: to BharatCode for the connection test, and to your backend with each request. The background worker sends it only for scheduled Gmail sync. The scripts that run on job sites can't read it.

## Privacy

Your resume text, job page text, form field labels, recruiter emails (only if Gmail sync is on) and the profile details each request needs go to BharatCode through your backend, with `store: false`. Your profile, resume files and applications stay in your browser's IndexedDB.

Your API key is stored only in `chrome.storage.local` on your device. It is never synced, bundled, logged or committed. The backend stores public job postings only: it keeps no profiles, resumes or keys, and it never logs request bodies.

[PRIVACY.md](PRIVACY.md) has the full details.

## Development

[CONTRIBUTING.md](CONTRIBUTING.md) lists the project rules and the commands that run the tests and checks. Tests never call BharatCode: the backend runs in mock mode and its HTTP calls are mocked.

## License

MIT
