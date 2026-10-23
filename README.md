# Job Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Chrome extension that turns your resume into a structured profile, finds and ranks jobs that fit it, drafts application answers it checks against your resume, and tracks every application. All AI features run on the [BharatCode](https://bharatcode.ai/build) API with your own key.

Built for the BharatCode Build League hackathon. Still under development: see [What works today](#what-works-today).

## Screenshots and demo

> Screenshots and a demo GIF go here.

## What it does

- **Resume to profile:** upload a PDF resume and get a structured profile you can review and edit. Every bullet gets a stable id so later checks can cite it.
- **Job matching:** filters and ranks cached jobs. The model reports which required skills match and which are missing, and the fit score is computed in code from those facts.
- **Tailored application answers:** drafts an answer for a job, splits it into claims, checks each claim against your resume and flags anything your resume does not support.
- **Application tracker:** records an application when you submit a Greenhouse or Lever form, tracks status changes, marks silent applications after 28 days, and can read recruiter emails from Gmail (read-only) to update statuses.
- **Safety:** warns about likely scam postings and text that tries to instruct the AI.

The extension never submits an application for you. It fills fields, and you review and click submit.

## What works today

| Feature | Status |
|---|---|
| Resume parsing and profile editing | Works from the side panel |
| Adding a job from the current page | Works from the side panel |
| Application tracker and dashboard | Works; records come from submissions on Greenhouse and Lever pages |
| Gmail status updates | Needs a real Google OAuth client ID in `extension/wxt.config.ts` |
| Job matching, drafting, form filling, scam check | Backend endpoints work; the side panel does not call them yet |

## Install

You need Node 22, npm, Python 3.12 and [uv](https://docs.astral.sh/uv/). Docker is optional.

1. Start the backend:

   ```bash
   cp .env.example .env
   cd backend
   uv sync
   uv run uvicorn app.main:app --port 8000
   ```

   Or run `docker compose up -d backend` from the repository root.

2. Build the extension:

   ```bash
   cd extension
   npm install
   npm run build
   ```

3. Load it in Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select `extension/.output/chrome-mv3`.
4. Open the extension's options page, paste your BharatCode key, click **Store key**, then **Test connection**. If your backend is not at `http://127.0.0.1:8000`, set its URL on the same page.
5. Click the toolbar icon to open the side panel.

## Get a BharatCode API key

Sign in at [bharatcode.ai/account](https://bharatcode.ai/account) and create a key. It is free for students with an `.ac.in` or `.edu.in` email; Lite and Pro plans also include API access. Until a key is saved, the side panel shows how to get one, and AI requests return a "key missing" message instead of failing silently.

## Model and endpoints

- **Model:** `qwen-3.8-27b` for every feature.
- **Base URL:** `https://bharatcode.ai/api/model/v1`, with `Authorization: Bearer <your key>`.
- **Generation:** `POST /responses` with `store: false`, so each call is stateless and resends its full context. Anything machine-readable, such as fit facts and claim verdicts, uses structured output (`text.format` with a JSON schema).
- **Connection test:** `GET /models`, then a 16-token `POST /responses`, from the options page. BharatCode answers `GET /models` for any key, so only the model call confirms that the key and its plan work.
- **Limits:** output budgets are 8,000 tokens for resume parsing, 4,000 for drafts and rewrites, and 2,000 for everything else. Reasoning effort is `none` except for drafting, rewriting and claim judging.
- **Errors:**
  - A cut-off answer is reported and never parsed or retried with the same budget.
  - A `503` is retried after 2, 4 and 8 seconds, then shown as "BharatCode is busy, try again".
  - A `402` means the account's plan has no API access yet, and the message says how to get it.
  - Failures log the `x-request-id` header.

All model calls go through one module, [`backend/app/llm/bharatcode.py`](backend/app/llm/bharatcode.py). The extension's background service worker is the only part of the extension that sends your key anywhere: to BharatCode for the connection test, and to your backend with each request.

## Privacy

- **Sent to BharatCode for processing:** your resume text, job descriptions and page text, form field labels, recruiter email text (only if Gmail sync is on), and the profile details each request needs. Requests use `store: false`.
- **Stays in your browser:** your profile, resume file and applications live in IndexedDB.
- **Your API key:** stored only in `chrome.storage.local` on your device. It is never synced, bundled, logged or committed.
- **The backend:** stores only public job postings. It keeps no profiles, resumes or keys and never logs request bodies.

See [PRIVACY.md](PRIVACY.md) for details.

## Development

```bash
cd backend && uv run pytest && uv run ruff check .
```

```bash
cd extension && npm test && npm run compile
```

Tests never call BharatCode: the backend runs in mock mode and HTTP calls are mocked.

## License

MIT
