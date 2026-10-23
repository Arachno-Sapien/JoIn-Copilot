# Privacy policy

Last updated: October 23, 2026

Job Copilot keeps your personal data in your browser. Some features have to send text to your Job Copilot backend, which passes it to BharatCode, the AI provider. This page lists what goes where.

## What stays in your browser

Your profile, your uploaded resume files and your applications (with their status history) are stored in your browser's IndexedDB. Your settings, including your BharatCode API key and backend URL, are stored in `chrome.storage.local`, which Chrome does not sync to your other devices.

Job Copilot never asks for passwords and has no user accounts.

## What the backend stores

The backend's SQLite database holds public job postings only. It keeps no profiles, resumes, drafts, applications, emails or keys, and it never logs request bodies. AI answers are cached in memory only, so they are gone when the backend restarts.

## What leaves your browser

Each feature sends only what it needs to your backend, and the backend sends it on to BharatCode:

- Resume upload: the PDF goes to `/profile/parse`. The backend pulls out the text and sends that to BharatCode.
- Adding a job: the text of the job page goes to `/jobs/extract`.
- Job matching: your profile and the jobs being ranked go to `/jobs/search`.
- Drafting an answer: the question, the job and your profile go to `/draft`. The draft is then checked claim by claim against your resume, which also runs on BharatCode.
- Form filling: the form's field labels and options, plus your profile, go to `/fill/map-fields`.
- Scam check: the backend sends the job posting to BharatCode.
- Gmail sync, which is off until you connect Gmail: the extension reads your mail through Google's read-only Gmail access. Each email's sender, subject, date and text, plus the company and role of each of your applications, go to `/email/classify`. Emails are never saved. Only the status change an email causes is stored, in your browser.

## BharatCode

Every AI feature runs on the BharatCode API (https://bharatcode.ai) with the model `qwen-3.8-27b`. The backend calls `POST /responses` with `store: false`, which asks BharatCode not to keep the conversation. BharatCode's own terms govern how it handles the data it receives.

You paste your own BharatCode key on the options page. Only the extension's background worker sends it anywhere: to BharatCode when you click Test connection, and to your backend with each AI request. The backend uses the key for that one request and never stores or logs it.

## No tracking

Job Copilot has no analytics, crash reporting or third-party trackers.

## Your controls

On the options page you can export all your data as JSON, or your applications as CSV. You can also remove your BharatCode key, or delete everything Job Copilot keeps in your browser, including your key and settings. Deleting asks you to confirm first and cannot be undone.

## Open source

Job Copilot is open source under the MIT License. You can read the code, build the extension yourself and run your own backend.
