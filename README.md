# Job Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Chrome extension that turns your resume into a structured profile, finds and ranks jobs that fit it, drafts application answers it checks against your resume, and tracks every application. All AI features run on the AI provider you choose, such as OpenAI, OpenRouter or a local Ollama, with your own key.

It is still under development: see [What works today](#what-works-today).

## Screenshots and demo

> Screenshots and a demo GIF go here.

## What it does

- Turns a PDF resume into a structured profile you can review and edit. Each bullet gets a stable id, so later checks can point to it.
- Fetches public postings from the Greenhouse boards, Lever companies and Adzuna searches you list, and ranks them against your profile. The model lists which required skills you have and which you're missing, and code turns those facts into the fit score.
- Drafts answers to application questions, splits each draft into claims and checks every claim against your resume. Anything your resume doesn't back up is flagged.
- Fills application forms from your profile on any page where you click the Job Copilot toolbar icon, and loads by itself on Greenhouse, Lever, Internshala and Unstop.
- Records an application when you submit a form it filled, or any Greenhouse or Lever form, and tracks its status. Jobs you applied to elsewhere, such as on LinkedIn or Naukri, can be added by hand. Applications with no reply for 28 days are marked as no response. With Gmail connected (read-only), recruiter emails update the status.
- Warns about postings that look like scams or that contain text trying to give the AI instructions.

The extension never submits an application for you. It fills in fields, and you review them and click submit.

## What works today

| Feature | Status |
|---|---|
| Resume parsing and profile editing | Works from the Profile tab. Each bullet keeps a stable id |
| Adding a job from the current page | Works from the Jobs tab on any page once you click the Job Copilot toolbar icon there. LinkedIn and Naukri are never read |
| Finding jobs | Works once you list job sources (see [Job sources](#job-sources)). The backend fetches them a few seconds after it starts and then daily, and drops postings older than 30 days. **Find jobs** on the Jobs tab ranks the 10 best fits |
| Fit scoring | Works. A job you add from a page is scored on its own. Ranking uses the `fastembed` embedding model, which the backend downloads the first time it ranks jobs. Without it, ranking falls back to a simpler word match and the backend logs a warning |
| Scam and prompt injection check | Runs when you select a job on the Jobs tab, for fetched jobs and jobs you added |
| Drafting answers | Works from the Draft tab for the selected job, with **Copy**. Claims your resume doesn't back up are flagged |
| Form filling | **Fill this page** fills what your profile answers, asks the AI about the remaining text fields, and attaches your newest resume to a resume upload field. Open questions wait until you approve a drafted answer. It fills only the page itself, or a form frame from the same site or a known job site |
| Application tracker | Works. Applications come from forms Job Copilot filled, from Greenhouse and Lever submissions, and from **Track application** for everything else |
| Gmail status updates | Needs your own Google OAuth client ID ([setup guide](docs/guide/setup.md#6-optional-set-up-gmail-sync)). Then **Connect Gmail** and **Sync now** on the Tracker tab, plus a sync every 3 hours. Matches the model is unsure of wait for you to confirm |

An automated end-to-end test drives the fill, submit and track flow through the side panel in Chromium. It has not yet been checked by hand in a real Chrome window.

## Install

On Windows, double-click `setup.bat` in the project folder. It checks for Chrome, uv and Node.js 22, offers to install missing tools with winget, sets up the backend, builds the extension and tells you how to load it. If it stops with an error, follow the steps below.

To set up by hand, you need Node 22, npm, Python 3.12 and [uv](https://docs.astral.sh/uv/). Docker is optional. The [setup guide](docs/guide/setup.md) walks through each step in more detail.

1. Start the backend from the repository root:

   ```bash
   cp .env.example .env
   cd backend
   uv sync
   uv run uvicorn app.main:app --port 8000
   ```

   Or run `docker compose up -d backend` from the repository root.

   To find jobs, list job sources in `.env` before you start the backend (see [Job sources](#job-sources)).

2. In a second terminal, build the extension from the repository root:

   ```bash
   cd extension
   npm install
   npm run build
   ```

3. Load it in Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `extension/.output/chrome-mv3`.
4. Right-click the Job Copilot icon and choose **Options**. Under **AI provider**, enter your provider's base URL, a model and your key (see [Choose an AI provider](#choose-an-ai-provider)), click **Store provider**, then **Test connection**. If your backend is not at `http://127.0.0.1:8000`, change **Backend URL** on the same page and click **Save Settings**.
5. Click the toolbar icon to open the side panel.

## Job sources

The backend fetches public job postings from the sources you list in `.env` in the repository root. Restart the backend after you change them.

| Setting | What it lists | Example |
| --- | --- | --- |
| `JC_GREENHOUSE_BOARDS` | Greenhouse board names, the part after `boards.greenhouse.io/` | `stripe,airbnb` |
| `JC_LEVER_COMPANIES` | Lever company names, the part after `jobs.lever.co/` | `netflix` |
| `JC_ADZUNA_QUERIES` | Adzuna searches. Also needs `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` from [developer.adzuna.com](https://developer.adzuna.com) | `software intern,data analyst` |
| `JC_ADZUNA_COUNTRY` | Adzuna's two-letter country code | `in` (the default) |

If one source fails, the others still load. With no sources listed, **Find jobs** says the backend has no jobs yet, and you can still add jobs from pages you open.

## Choose an AI provider

Job Copilot works with any API that speaks the OpenAI chat completions format. Pick a model that supports structured output (a JSON schema response format). Some common choices:

| Provider | Base URL | Key |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | From your OpenAI account |
| OpenRouter | `https://openrouter.ai/api/v1` | From your OpenRouter account |
| Ollama, on your computer | `http://localhost:11434/v1` | None |

If the backend runs in Docker, `localhost` means the container, so reach Ollama on your computer at `http://host.docker.internal:11434/v1` instead.

The backend calls only https providers on the internet and providers on the computer it runs on. To use one elsewhere on your network, such as Ollama on another machine, add its base URL to `JC_LLM_BASE_URLS` in `.env`. On a backend other people can reach, always set `JC_LLM_BASE_URLS` ([self-hosting guide](docs/guide/self-hosting.md)).

If no provider is set up, the side panel says so, and AI requests return a "No AI provider set up" message instead of failing silently.

## How the model is called

Every feature sends `POST <base URL>/chat/completions` with your model, a system and a user message, and a `json_schema` response format built from a Pydantic schema. Your key goes as `Authorization: Bearer <your key>` when you set one. Each call is stateless and resends its full context, and everything the code reads back, such as fit facts and claim verdicts, is validated against that schema.

Test connection on the options page asks your backend (`POST /llm/check`) for one tiny structured call. It passes only when the URL, model and key work together and the model answers with JSON.

When a call fails:

- A cut-off answer (`finish_reason: length`) is reported, never parsed and never retried.
- A `429` or `503` is retried after 2, 4 and 8 seconds, then shown as "The AI provider is busy or rate-limited, try again".
- Any other error shows the provider's own message.
- The backend logs the `x-request-id` header when the provider sends one.

All model calls go through one module, [`backend/app/llm/provider.py`](backend/app/llm/provider.py). The extension never calls the provider itself: the side panel and options page send your provider settings to your backend with each request, and the background worker sends them only for scheduled Gmail sync. The scripts that run on job sites can't read them.

## Privacy

Your resume text, job page text, form field labels, recruiter emails (only if Gmail sync is on) and the profile details each request needs go to your AI provider through your backend. Your profile, resume files and applications stay in your browser's IndexedDB.

Your provider settings and API key are stored only in `chrome.storage.local` on your device. It is never synced, bundled, logged or committed. The backend stores public job postings only: it keeps no profiles, resumes or keys, and it never logs request bodies.

[PRIVACY.md](PRIVACY.md) has the full details.

## Development

[CONTRIBUTING.md](CONTRIBUTING.md) lists the project rules and the commands that run the tests and checks. Tests never call a real model: the backend runs in mock mode and its HTTP calls are mocked.

## License

MIT
