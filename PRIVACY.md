# Privacy policy

Last updated: November 15, 2026

Job Copilot keeps your personal data in your browser. Some features have to send text to your Job Copilot backend, which passes it to the AI provider you chose. This page lists what goes where.

## What stays in your browser

Your profile, your uploaded resume files and your applications (with their status history) are stored in your browser's IndexedDB. Your settings, including your AI provider settings, API key and backend URL, are stored in `chrome.storage.local`, which Chrome does not sync to your other devices.

Job Copilot never asks for passwords and has no user accounts.

## What the backend stores

The backend's SQLite database holds public job postings only. It keeps no profiles, resumes, drafts, applications, emails or keys, and it never logs request bodies. AI answers are cached in memory only, so they are gone when the backend restarts.

## What leaves your browser

Each feature sends only what it needs to your backend, and the backend sends it on to your AI provider:

- Resume upload: the PDF goes to `/profile/parse`. The backend pulls out the text and sends that to your AI provider.
- Adding a job: the text of the job page goes to `/jobs/extract`.
- Job matching: your profile and the jobs being ranked go to `/jobs/search`.
- Drafting an answer: the question, the job and your profile go to `/draft`. The draft is then checked claim by claim against your resume, which also runs on your AI provider.
- Form filling: the form's field labels and options, plus your profile, go to `/fill/map-fields`.
- Scam check: the backend sends the job posting to your AI provider.
- Gmail sync, which is off until you connect Gmail: the extension reads your mail through Google's read-only Gmail access. Each email's sender, subject, date and text, plus the company and role of each of your applications, go to `/email/classify`. Emails are never saved. Only the status change an email causes is stored, in your browser.

## Your AI provider

Every AI feature runs on the OpenAI-compatible provider and model you set on the options page, such as OpenAI, OpenRouter or a model running on your own computer with Ollama. The backend calls the provider's `POST /chat/completions`. The provider's own terms govern how it handles the data it receives, so check whether it keeps or trains on API requests. A local model keeps everything on your machine.

You enter your provider's base URL, model and key on the options page. The extension never sends them to the provider itself. Its own pages send them to your backend with each AI request, including when you click Test connection. The background worker also sends them to your backend for scheduled Gmail sync. The scripts Job Copilot runs on job sites can't read them. The backend uses them for that one request and never stores or logs them.

## No tracking

Job Copilot has no analytics, crash reporting or third-party trackers.

## Your controls

On the options page you can export all your data as JSON, or your applications as CSV. You can also remove your AI provider settings and key, or delete everything Job Copilot keeps in your browser, including your key and settings. Deleting asks you to confirm first and cannot be undone.

## Open source

Job Copilot is open source under the MIT License. You can read the code, build the extension yourself and run your own backend.
