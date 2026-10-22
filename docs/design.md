# AI Job Search Copilot: Technical Design

A browser extension that finds jobs and internships matching a user's resume, drafts honest application answers, fills application forms with the user in control, and tracks every application through to an outcome.

This document covers what to build, which technologies to use, and why each decision was made. It is written for a solo developer building an open source project, with outside testers joining once the extension works end to end.

---

## Table of contents

1. [Goals and non-goals](#1-goals-and-non-goals)
2. [Guiding decisions](#2-guiding-decisions)
3. [System architecture](#3-system-architecture)
4. [Tech stack and reasoning](#4-tech-stack-and-reasoning)
5. [Data model](#5-data-model)
6. [Extension design](#6-extension-design)
7. [Backend design](#7-backend-design)
8. [The GenAI components](#8-the-genai-components)
9. [The form-filling agent](#9-the-form-filling-agent)
10. [Gmail status tracking](#10-gmail-status-tracking)
11. [Security, privacy and prompt injection](#11-security-privacy-and-prompt-injection)
12. [Testing and evaluation](#12-testing-and-evaluation)
13. [Open source setup](#13-open-source-setup)
14. [Build order](#14-build-order)
15. [Decisions deliberately not taken](#15-decisions-deliberately-not-taken)
16. [Open questions](#16-open-questions)

---

## 1. Goals and non-goals

### Goals

- Turn a resume into a structured, user-editable profile.
- Find relevant openings from allowed sources and rank them with explained fit scores.
- Draft cover letters and application answers that never claim anything the resume does not support.
- Fill application forms on the page the user is viewing, and stop before submit.
- Track applications and update their status from recruiter emails.
- Show simple analytics about what is and is not working.
- Warn users about likely fake or scam listings.

### Non-goals

- **Fully automated mass applying.** It violates most platforms' terms, risks the user's accounts, and tends to lower response rates because recruiters filter out generic floods of applications.
- **Scraping LinkedIn, Naukri or similar platforms.** Their terms prohibit it, they actively detect it, and a scraper breaks every time the site changes.
- **Storing user passwords.** The extension works inside sessions the user has already logged into.
- **Supporting every job site on day one.** A few sites done reliably beat many done badly.

---

## 2. Guiding decisions

These five decisions shape everything else. When a later choice is unclear, check it against these.

### 2.1 The user's browser is the trust boundary

All personal data (profile, resume, application history, email-derived statuses) lives in the user's browser. The backend handles only work that needs an API key or heavy computation, and it does not store personal data.

**Why:** It is the simplest way to be trustworthy. If the backend is breached, there is nothing personal to steal. It also makes self-hosting cheap, since the server needs no user database.

### 2.2 A pipeline with LLM steps, not a free-roaming agent

The "agent" is a sequence of well-defined steps, some of which call an LLM: parse, fetch, rank, draft, check, fill. The LLM never decides on its own to click a button, open a URL or send an email.

**Why:**
- **Reliability.** Each step can be tested in isolation. A fully autonomous browser agent fails in ways that are hard to reproduce.
- **Cost.** A fixed pipeline makes a predictable number of model calls. An autonomous agent can loop for many calls on a single form.
- **Safety.** Job descriptions and emails are untrusted text. If the model can take actions, a malicious posting can instruct it to do things. If the model only returns structured data and your code acts on it, that attack surface mostly disappears.

The trade-off is flexibility: an autonomous agent can, in principle, handle a site it has never seen. In practice, that flexibility is unreliable today, and the pipeline still uses the LLM where flexibility matters most (understanding unfamiliar form labels and free-text questions).

### 2.3 A human submits every application

The extension fills and drafts. The user reviews and clicks submit.

**Why:** It keeps the tool within platform rules, keeps the user responsible for what is sent in their name, and catches the model's mistakes before they reach a recruiter.

### 2.4 Every generated claim must trace to the resume

Generated text passes through a fabrication checker before the user sees it. Unsupported claims are flagged.

**Why:** LLMs routinely inflate experience when asked to "tailor" an application. An application with invented claims can cost the user the job at the interview stage, or later. This is also the feature that most clearly sets the project apart from existing tools.

### 2.5 Provider-agnostic and self-hostable

The code does not depend on one LLM provider, and anyone can run the backend themselves with their own API keys.

**Why:** It keeps an open source project usable without relying on the maintainer's hosting budget, lets contributors test with local models, and avoids lock-in if a provider changes prices or terms.

---

## 3. System architecture

```
┌─────────────────────────── Outside services ───────────────────────────┐
│  Job pages the user opens    Gmail API      Job board APIs    LLM API   │
│  (Greenhouse, Lever, any)    (read-only)    (Adzuna,          (hosted   │
│                                              Greenhouse,       or local │
│                                              Lever)            Ollama)  │
└───────┬──────────────────────────┬──────────────┬─────────────────┬────┘
        │ reads, fills             │ emails       │ fetch jobs      │ prompts
┌───────▼──────────────────────────▼────┐   ┌─────▼─────────────────▼─────┐
│ Browser extension (user's Chrome)     │   │ Backend (FastAPI)           │
│                                       │   │                             │
│  Content scripts                      │   │  Resume parser              │
│    read job pages, fill forms,        │◄─►│  Job fetcher and cache      │
│    stop before submit                 │API│  Matching                   │
│  Side panel and dashboard             │   │  Tailoring + fabrication    │
│    job list, drafts, tracker, charts  │   │    checker                  │
│  Background service worker            │   │  Classifiers (scam, email)  │
│    messaging, Gmail sync, scheduling  │   │                             │
│  IndexedDB                            │   │  Stateless for user data;   │
│    profile, applications (local only) │   │  caches public jobs only    │
└───────────────────────────────────────┘   └─────────────────────────────┘
```

### A typical run

1. The user uploads a resume in the side panel. The extension sends it to the backend, which returns a structured profile. The extension saves it to IndexedDB and shows it for correction.
2. The extension asks the backend for matches, sending the profile. The backend filters and ranks cached jobs and returns them with fit reasons.
3. The user opens a job. On a supported site, the content script reads the form and asks the backend for field values and drafted answers.
4. The backend drafts answers, runs the fabrication checker, and returns drafts with any flagged claims.
5. The content script fills the form and highlights every filled field. The user edits and clicks submit.
6. The extension detects the submission and logs it in the tracker.
7. Periodically, the background worker pulls recent recruiter emails from Gmail, asks the backend to classify them, and updates statuses.

---

## 4. Tech stack and reasoning

### 4.1 Extension

| Concern | Choice | Reasoning |
| --- | --- | --- |
| Platform | Chrome, Manifest V3 | MV3 is mandatory for new Chrome Web Store extensions. Chrome and other Chromium browsers (Edge, Brave) cover most users. Firefox support can follow later, since MV3 is mostly compatible there. |
| Language | TypeScript | Extensions pass many message types between contexts; static types catch mismatched messages at build time instead of as silent runtime failures. |
| Framework | WXT | Vite-based, actively maintained, handles manifest generation, hot reload across extension contexts, and cross-browser builds. Plasmo is the main alternative, but its development has slowed; raw MV3 without a framework means hand-writing build config for little benefit. |
| UI | React + Tailwind CSS | The side panel and dashboard are small apps with state. React has the largest ecosystem and the most help available; Tailwind avoids writing and maintaining separate stylesheets. Svelte or Preact would also work and are lighter, but the size difference matters little in an extension. |
| UI surface | Chrome Side Panel API | A side panel stays open beside the job page while the user reviews filled fields. A popup closes as soon as the user clicks the page, which breaks the review flow. |
| Local storage | IndexedDB via Dexie.js | Needs to hold hundreds of applications with queries (by status, date, company). `chrome.storage.local` is a key-value store that gets awkward for that. Dexie wraps IndexedDB's clumsy API and supports schema migrations, which you will need as the data model evolves. |
| Small settings | `chrome.storage.local` | Settings (backend URL, preferences) are small and benefit from Chrome's change events across contexts. |
| Charts | Recharts | Fits naturally with React. Chart.js is equally fine. |
| Validation | Zod | Validates backend responses and stored data at runtime. Types alone do not protect against malformed data from the network. |

### 4.2 Backend

| Concern | Choice | Reasoning |
| --- | --- | --- |
| Language | Python 3.12 | The GenAI, embedding and evaluation ecosystem is Python-first. Writing evaluation scripts in the same language as the pipeline means evaluations run the real code, not a reimplementation. |
| Framework | FastAPI | Async (useful because most time is spent waiting on LLM APIs), Pydantic integration for request and response validation, and automatic OpenAPI docs that contributors can read. Flask lacks native async and typed validation; Django is far more than a stateless API needs. |
| Data validation | Pydantic v2 | The same models validate API requests and LLM structured outputs, so there is one definition of each schema. |
| LLM access | A thin provider wrapper, optionally via LiteLLM | LiteLLM gives one interface over most providers and Ollama. Wrapping it in your own small module means you can swap or drop it later without touching business logic. |
| Structured output | `instructor` library, or the provider's native JSON schema mode | Forces model output into a Pydantic schema with automatic retries on validation failure. Parsing free text with regex is fragile. |
| Embeddings | `sentence-transformers` with `bge-small-en-v1.5` (or `all-MiniLM-L6-v2`) | Free, runs on CPU in milliseconds per job, and good enough for resume-to-job similarity. Paid embedding APIs add cost and a dependency for little gain at this scale. |
| Vector search | NumPy cosine similarity or FAISS, in memory | Even thousands of cached jobs fit in memory. A dedicated vector database (Pinecone, Weaviate) adds a service to run and pay for with no benefit at this size. |
| Job cache | SQLite | One file, no server, enough for a single-instance backend. Move to Postgres only if a hosted instance serves many users. |
| PDF parsing | PyMuPDF | Fast and reliable text extraction. It cannot read scanned image-only PDFs; for those, ask the user for a text-based resume rather than adding OCR complexity early. |
| Scheduling | APScheduler inside the app | Refreshing job sources daily needs a timer, not a separate queue system like Celery. |
| Packaging | Docker + docker compose | Lets anyone self-host with one command. |
| Hosting | Render or Railway free tier | Deploys from GitHub with no server management. Free tiers sleep when idle, which is acceptable for a personal project. |

### 4.3 Models

| Task | Model size | Reasoning |
| --- | --- | --- |
| Resume parsing, job field extraction, form field mapping | Small, fast model | These are extraction tasks with a fixed schema. Small models handle them well and cost a fraction of large ones. |
| Drafting answers and cover letters | Strong model | Writing quality is visible to recruiters. This is where a better model pays off. |
| Fabrication checking (judge) | Strong model, or a dedicated NLI model as a cheaper baseline | Judging whether a resume line supports a claim needs careful reasoning. A natural language inference model such as a DeBERTa model fine-tuned on MNLI is a useful, nearly free baseline to compare against. |
| Scam and email classification | Small model | Short texts, few labels. |

Keep model names in configuration, never in code, so they can change without code edits.

---

## 5. Data model

All schemas are defined once in Pydantic on the backend and mirrored as Zod schemas in the extension. Version them, because stored data outlives code changes.

### 5.1 Profile (stored in the browser)

```json
{
  "schema_version": 1,
  "name": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "links": { "linkedin": "url", "github": "url", "portfolio": "url" },
  "education": [
    { "id": "edu-1", "degree": "string", "institution": "string",
      "start": "YYYY-MM", "end": "YYYY-MM", "score": "string" }
  ],
  "experience": [
    { "id": "exp-1", "role": "string", "org": "string",
      "start": "YYYY-MM", "end": "YYYY-MM | present",
      "bullets": [ { "id": "exp-1-b1", "text": "string" } ] }
  ],
  "projects": [
    { "id": "proj-1", "name": "string",
      "bullets": [ { "id": "proj-1-b1", "text": "string" } ] }
  ],
  "skills": [ { "name": "string", "level": "familiar | working | strong" } ],
  "certifications": [ { "id": "cert-1", "name": "string", "issuer": "string" } ],
  "preferences": {
    "locations": ["string"], "remote": "any | remote | onsite | hybrid",
    "job_types": ["internship", "full-time"], "min_stipend": "number | null",
    "avoid_keywords": ["string"]
  }
}
```

**Why every bullet has an ID:** the fabrication checker cites bullet IDs as evidence. Without stable IDs, there is no reliable way to show which resume line supports a claim.

**Why skill level is explicit:** it stops the drafter from upgrading "familiar with Docker" into "experienced with Docker." The level the user set is the ceiling.

### 5.2 Job (cached on the backend)

```json
{
  "id": "sha1(source + source_id)",
  "source": "adzuna | greenhouse | lever | manual",
  "source_id": "string",
  "url": "string",
  "title": "string",
  "company": "string",
  "location": "string",
  "remote": "remote | onsite | hybrid | unknown",
  "job_type": "internship | full-time | contract | unknown",
  "required_skills": ["string"],
  "nice_to_have_skills": ["string"],
  "experience_years_min": "number | null",
  "description": "string",
  "posted_at": "ISO date | null",
  "deadline": "ISO date | null",
  "fetched_at": "ISO datetime"
}
```

### 5.3 Application (stored in the browser)

```json
{
  "id": "uuid",
  "job_id": "string",
  "job_snapshot": { "title": "...", "company": "...", "url": "...", "source": "..." },
  "applied_at": "ISO datetime",
  "fit_score": 0,
  "missing_skills": ["string"],
  "resume_version": "string",
  "answers": [ { "question": "string", "answer": "string", "flags": [] } ],
  "status": "applied | viewed | assessment | interview | offer | rejected | no_response | withdrawn",
  "status_history": [ { "status": "string", "at": "ISO datetime", "source": "user | gmail | portal | auto" } ],
  "notes": "string"
}
```

**Why a job snapshot:** job postings disappear after they close. The tracker must still show what the user applied for.

**Why status history:** analytics like "days to first reply" need every transition, not just the current state.

---

## 6. Extension design

### 6.1 Extension contexts

| Context | Responsibility |
| --- | --- |
| Background service worker | Central message router, Gmail sync on a timer, calls to the backend |
| Content scripts | Read job pages, detect forms, fill fields, detect submission |
| Side panel | Main UI: profile, job list, current job, drafts, review |
| Dashboard page | Full tracker table and analytics |
| Options page | Backend URL, model choices if self-hosting, privacy controls, data export and delete |

### 6.2 MV3 service worker lifecycle

Chrome stops an MV3 service worker after about 30 seconds of inactivity. Anything held in memory is lost.

**Decisions that follow:**
- Never keep state in service worker variables. Read from storage on every event.
- Use `chrome.alarms` for periodic tasks (Gmail sync), not `setInterval`, which dies with the worker.
- Keep long LLM calls short or let the side panel make them, since the side panel stays alive while open.

### 6.3 Messaging

Use one typed message layer for all communication between contexts, for example a discriminated union in TypeScript:

```ts
type Message =
  | { type: "PAGE_FORM_DETECTED"; fields: FormField[]; url: string }
  | { type: "FILL_REQUEST"; jobId: string }
  | { type: "FILL_RESULT"; filled: FilledField[]; skipped: FormField[] }
  | { type: "APPLICATION_SUBMITTED"; jobId: string; url: string };
```

**Why:** untyped `chrome.runtime.sendMessage` calls are a common source of silent bugs, where one side renames a field and the other side receives `undefined`.

### 6.4 Permissions

| Permission | Why it is needed |
| --- | --- |
| `sidePanel` | The main UI |
| `storage` | Settings |
| `alarms` | Periodic Gmail sync |
| `identity` | Google OAuth for Gmail, without handling passwords |
| `activeTab` + `scripting` | Read or fill the current tab when the user clicks the extension, on any site, without broad host permissions |
| Host permissions for supported ATS domains only (e.g. `boards.greenhouse.io`, `jobs.lever.co`) | Lets content scripts run automatically on known application pages |

**Why not `<all_urls>`:** broad host permissions trigger a frightening install warning, slow Chrome Web Store review, and give the extension more power than it needs. `activeTab` grants temporary access to the current tab only when the user clicks, which covers the "add this job from any site" feature.

### 6.5 Site adapters

Each supported site gets an adapter file implementing one interface:

```ts
interface SiteAdapter {
  matches(url: URL): boolean;
  extractJob(doc: Document): Partial<Job>;
  findFormRoot(doc: Document): Element | null;
  listFields(root: Element): FormField[];
  fillField(field: FormField, value: string | File): Promise<boolean>;
  detectSubmission(onSubmit: () => void): void;
}
```

A generic adapter handles unknown sites on a best-effort basis.

**Why adapters:** form markup differs a lot between sites. Isolating that mess in one file per site keeps the core logic clean and lets contributors add a site without understanding the whole codebase.

Start with **Greenhouse** and **Lever**: many companies use them, their forms are fairly standard, and they also expose public job listing endpoints. Add **Workday** later; it is widely used but much harder (multi-page flows, shadow DOM, custom widgets).

---

## 7. Backend design

### 7.1 API surface

| Endpoint | Purpose |
| --- | --- |
| `POST /profile/parse` | PDF upload in, structured profile out |
| `POST /jobs/search` | Profile and filters in, ranked jobs with fit reasons out |
| `POST /jobs/extract` | Page text from a pasted link in, structured Job out |
| `POST /jobs/{id}/scam-check` | Risk level and red flags |
| `POST /fill/map-fields` | Form fields and profile in, value per field out |
| `POST /draft` | Job, question and profile in, draft plus fabrication report out |
| `POST /email/classify` | Email metadata and body plus candidate applications in, matched application and label out |
| `GET /health` | Health check for hosting |

The profile is sent with each request rather than stored on the server. This keeps the backend stateless for user data, at the cost of slightly larger requests, which is negligible.

### 7.2 Job sources

| Source | Access | Notes |
| --- | --- | --- |
| Adzuna API | Free API key | Covers India and many other countries; search by keywords and location |
| Greenhouse job boards | Public JSON endpoints per company | Keep a curated list of company board names; poll daily |
| Lever postings | Public JSON endpoints per company | Same approach as Greenhouse |
| Manual link | User clicks "Add this job" on any page | Content script sends page text; the LLM extracts the Job schema |

**Why these:** they permit programmatic access, return structured data, and will not get anyone's account banned. The manual link path covers everything else, including LinkedIn postings the user is browsing themselves.

**Deduplication:** the same job often appears on several sources. Normalize company names (lowercase, strip "Pvt Ltd", "Inc") and compare title and location with fuzzy matching, for example `rapidfuzz` with a high threshold.

### 7.3 Caching and cost control

- Cache LLM outputs keyed by a hash of the prompt template version and its inputs. Re-ranking the same job for the same profile should never cost twice.
- Run the expensive LLM rerank only on the top candidates after cheap filtering and embedding recall.
- Store prompt templates as versioned files in the repo, so a cache entry is invalidated automatically when its prompt changes.

---

## 8. The GenAI components

### 8.1 Resume parsing

1. Extract text with PyMuPDF.
2. Ask a small model to fill the profile schema using structured output.
3. Validate with Pydantic. On failure, retry once with the validation error included in the prompt.
4. Assign stable IDs to every bullet.
5. Return to the extension, where the user corrects anything wrong.

**Why an LLM rather than a rule-based parser:** resumes have no standard layout. Rule-based parsers break on two-column layouts, unusual headings and mixed formats. Use a regex parser only as the evaluation baseline.

**Why the user confirms:** parsing errors propagate into every later step. One review screen at the start is cheaper than wrong matches and wrong drafts later.

### 8.2 Matching and fit score

Three stages, from cheap to expensive:

1. **Hard filters (no model):** location, job type, remote preference, experience level, avoid keywords.
2. **Embedding recall:** embed the profile summary and each job description, keep the top 50 by cosine similarity.
3. **LLM rerank:** for each candidate, a small model returns:

```json
{
  "matched_required": ["Python", "SQL"],
  "missing_required": ["Docker"],
  "matched_nice_to_have": ["FastAPI"],
  "experience_gap": "Requires 1 year; profile shows 6 months of internships",
  "summary": "Strong skill match, slightly short on experience"
}
```

The **final score** is computed in code from these fields (for example, a weighted share of required skills matched, minus a penalty for experience gap), not asked from the model directly.

**Why compute the score in code:** LLM-generated numeric scores are poorly calibrated and drift between runs. Asking for structured facts and scoring them with a formula gives stable, explainable numbers.

**Why three stages:** running an LLM over every cached job would be slow and expensive. Filters and embeddings cut thousands of jobs to dozens cheaply; the LLM adds judgment only where it matters.

### 8.3 Drafting with the fabrication checker

This is the core of the project.

**Step 1: Draft.** A strong model receives the job, the question, and the profile, with each bullet shown with its ID. It is instructed to write the answer and to cite bullet IDs for every factual statement, and to stay within each skill's stated level.

**Step 2: Extract claims.** A second call splits the draft into atomic factual claims, such as "built a REST API with FastAPI" or "worked in a team of four." Opinions and enthusiasm ("I'm excited about your mission") are not claims and are skipped.

**Step 3: Retrieve evidence.** For each claim, retrieve the most similar profile bullets by embedding similarity, plus any bullets the draft cited.

**Step 4: Judge.** For each claim and its evidence, a judge returns `supported`, `partly_supported` or `unsupported`, with a one-line reason.

**Step 5: Act.** The extension shows the draft with unsupported claims highlighted and offers a rewrite that removes or softens them using only supported facts.

**Why not trust the citations from step 1:** models sometimes cite a bullet that does not actually support the claim. Independent verification catches this.

**Why claim-level rather than whole-answer checking:** a whole-answer judge tends to approve an answer that is mostly true. Claim-level checking catches the single inflated sentence, which is exactly the one that causes trouble in interviews.

**Baseline for evaluation:** an NLI model (resume bullet as premise, claim as hypothesis). It is fast and free, and comparing it against the LLM judge is a meaningful result in itself.

### 8.4 Scam detection

Two layers combined:

- **Rule signals:** mentions of registration or training fees, security deposits, contact only through WhatsApp or a personal email domain, pay far above the market for the role, no verifiable company website, urgency with no interview step, vague responsibilities.
- **LLM classifier:** reads the posting and returns a risk level and the specific red flags it found.

Combine into Low, Medium or High risk, and always show the reasons.

**Why both:** rules are precise and explainable but miss new scam patterns. The LLM catches unusual wording but can be overconfident. Together, and with reasons shown, they are more trustworthy than either alone.

**Why show reasons:** a bare "High risk" label on a real job could cost a user an opportunity. Reasons let them judge for themselves.

### 8.5 Prompt engineering conventions

- Each prompt is a versioned template file in `backend/app/prompts/`.
- Untrusted content (job descriptions, page text, emails) is wrapped in clearly delimited blocks, and the system prompt states that text inside them is data, never instructions.
- Every prompt that feeds code returns structured output validated by Pydantic.
- Prompt changes run the relevant evaluation set before merging.

---

## 9. The form-filling agent

### 9.1 The loop

```
observe → map → fill → verify → hand over to the user
```

1. **Observe.** The adapter lists fields: element type, label text, placeholder, `name` and `id` attributes, nearby text, required flag, dropdown options.
2. **Map.** Rule-based mapping handles obvious fields (name, email, phone, LinkedIn URL, graduation year). The remaining fields go to the backend, where a small model maps them to profile values or marks them as open questions for the drafter.
3. **Fill.** The adapter sets values in a way the page will register (see 9.2).
4. **Verify.** Re-read every filled field and compare it with the intended value. Report any mismatch.
5. **Hand over.** Highlight filled fields, list skipped or uncertain ones in the side panel, and leave submit to the user.

**Why verify:** many forms silently reject or reformat programmatic input. Without a re-read, the extension would report success on fields that are actually empty.

### 9.2 Filling techniques that work on modern forms

- **Text inputs in React and similar frameworks:** setting `element.value` directly is often ignored, because the framework tracks its own state. Use the native value setter from `HTMLInputElement.prototype`, then dispatch `input` and `change` events with `bubbles: true`.
- **Native selects:** set the value, then dispatch `change`.
- **Custom dropdowns** (divs styled as selects): simulate the click to open, find the option by text, and click it. These are site-specific and belong in adapters.
- **File uploads:** create a `File` from the stored resume, put it in a `DataTransfer` object, assign `input.files`, and dispatch `change`.
- **Iframes:** Greenhouse often embeds the form in an iframe. Declare content scripts with `all_frames: true` so they run inside it.
- **Shadow DOM:** traverse open shadow roots recursively. Closed shadow roots cannot be reached; mark those fields for manual entry.
- **Pacing:** fill fields one at a time with a short delay. Some forms validate on blur and misbehave when every field changes at once.

### 9.3 Submission detection

- Listen for the form's `submit` event and for clicks on submit buttons.
- Watch for confirmation pages or messages ("Thank you for applying", "Application received") using a `MutationObserver`.
- When detected, log the application with the job snapshot and the answers actually present in the form at that moment, which may differ from the drafts if the user edited them.

### 9.4 Why not a vision-based or fully autonomous browser agent

Computer-use and browser-use agents can operate unfamiliar sites by looking at screenshots. They are not the primary approach here because they are slower (seconds per action), more expensive (many model calls per form), harder to test reproducibly, and more exposed to prompt injection from page content. They could make a good fallback for unknown sites later, used only with the user watching and never with permission to submit.

---

## 10. Gmail status tracking

### 10.1 Authentication

Use `chrome.identity.getAuthToken` with the `gmail.readonly` scope.

**Why:** Chrome handles the OAuth flow and token refresh, and the extension never sees a password. `getAuthToken` works only in Google Chrome; for other Chromium browsers, fall back to `chrome.identity.launchWebAuthFlow`.

**Restricted scope note:** `gmail.readonly` is a restricted scope. While the Google Cloud project is in testing mode, you can add up to 100 test users without Google's verification process, which is enough for development and early testers. Publishing to the general public requires Google's verification, including a security assessment for restricted scopes. Plan for that only once the project has real users.

### 10.2 Sync flow

1. Every few hours (via `chrome.alarms`), search Gmail for messages since the last sync, using a query built from tracked company names and sender domains plus words like "application", "interview" and "assessment".
2. Fetch only matching messages.
3. Send each email's sender, subject, date and body, together with a short list of candidate applications, to `/email/classify`.
4. The backend matches the email to an application and classifies it: `acknowledgement`, `assessment`, `interview`, `rejection`, `offer` or `other`.
5. If confidence is high, update the status automatically and record `source: gmail` in the history. If not, show a one-click confirmation in the side panel.
6. Store only the resulting label and date. Never store email bodies.

**Why a targeted search instead of reading the whole inbox:** less data leaves the browser, fewer model calls are made, and the user can understand exactly what the extension reads.

**Why ask when unsure:** a wrongly marked "Rejected" can make a user stop following up on a live application.

### 10.3 Other status sources

- **Portal pages:** when the user visits pages like LinkedIn's applied jobs list themselves, the content script can read visible statuses. This reads only what the user opened, at human pace.
- **Manual:** one-click status changes in the tracker.
- **Automatic:** mark `no_response` after 28 days without an update.

---

## 11. Security, privacy and prompt injection

### 11.1 Prompt injection

Job descriptions and emails are written by strangers. Some will contain text aimed at AI tools, either as a test or as an attack.

Defenses, in order of importance:

1. **No dangerous capabilities.** The LLM has no tools. It returns structured data; your code decides what to do with it. It cannot send email, open URLs, or submit forms.
2. **Human gates.** Submission always requires the user's click.
3. **Delimiting.** Untrusted text is placed in marked data blocks with an explicit instruction that their contents are never instructions.
4. **Output validation.** Field values are checked against expectations (an email field must contain the profile's email; a URL field must contain one of the profile's links). An unexpected email address or URL in a draft is flagged.
5. **Detection.** Flag postings containing instruction-like phrases and warn the user.

### 11.2 Data handling

- No passwords are ever requested or stored.
- Profile, resume and application history stay in IndexedDB in the user's browser.
- The backend processes requests in memory and does not log request bodies. Configure logging to record only metadata (endpoint, latency, status code).
- API keys live on the backend. Never put them in the extension bundle, since anyone can unpack an extension and read them.
- Provide "Export my data" (JSON and CSV) and "Delete all my data" in the options page.
- Write a short, plain-language privacy policy. The Chrome Web Store requires one for extensions that handle personal data.

### 11.3 Supply chain

- Pin dependency versions and enable Dependabot.
- Keep extension dependencies minimal. Every package in the bundle runs with the extension's permissions.

---

## 12. Testing and evaluation

### 12.1 Software testing

| Layer | Tool | What to test |
| --- | --- | --- |
| Backend units | pytest | Schema validation, scoring formula, deduplication, rule-based scam signals |
| Backend API | pytest + FastAPI TestClient | Each endpoint with fixed inputs, LLM calls mocked |
| Extension units | Vitest | Field mapping rules, message validation, storage migrations |
| Adapters | Vitest + saved HTML snapshots | Each adapter against real page snapshots saved in the repo |
| End to end | Playwright with the extension loaded | Full fill flow on the mock job portal |

**Why saved snapshots:** live job pages change and disappear. Snapshots make adapter tests reproducible, and when a site changes, a new snapshot shows exactly what broke.

### 12.2 Mock job portal

A small local site (Flask or Next.js) with login, search, about 30 postings, and deliberately hard forms: dependent dropdowns, multi-step pages, file upload, date pickers, required checkboxes, and free-text questions. A few postings contain planted prompt injection text.

**Why:** it gives a stable, legal, repeatable environment to measure the form-filling agent, and a reliable demo that does not depend on any real site.

### 12.3 GenAI evaluation

| Component | Dataset | Baseline | Metric |
| --- | --- | --- | --- |
| Resume parser | 20 to 30 resumes, hand-labeled | Regex parser | Field accuracy, skills F1 |
| Matching | Volunteers rank 20 jobs for their own resumes | Embedding similarity alone | NDCG@10 |
| Fabrication checker | 100 drafts with labeled claims, including deliberately inflated ones | NLI model | Precision and recall on unsupported claims; unsupported claim rate before and after |
| Scam detector | Known scam postings plus genuine ones | Rules only | Precision, recall, false alarm rate on genuine jobs |
| Email classifier | 100 to 150 anonymized recruiter emails | Keyword rules | Macro F1, confusion matrix |
| Form agent | 30 applications on the mock portal | Rules-only mapping | Task success rate, field accuracy, failures by field type |
| Injection resistance | 20 postings with planted instructions | Pipeline without defenses | Attack success rate |

Keep test sets fixed and never tune prompts against them. Record cost and latency per run alongside accuracy. Store results as CSV in `backend/eval/results/` so changes over time are visible in git history.

### 12.4 User testing

Once the extension works end to end, invite 5 to 10 testers from the open source release. Measure time per application compared with applying manually and how often they edit the drafts. Collect broken-adapter reports through GitHub issues.

---

## 13. Open source setup

- **License:** MIT or Apache 2.0 from the first commit. Apache 2.0 adds an explicit patent grant; MIT is shorter. Either is fine for this project.
- **Secrets:** keys only in `.env`; commit a `.env.example` with variable names. Turn on GitHub secret scanning and push protection.
- **README:** what it does, a demo GIF, how to load the unpacked extension, how to run the backend with docker compose, and how to point the extension at a self-hosted backend.
- **CI:** GitHub Actions running lint, type checks and tests on every pull request. Evaluations run manually or on a schedule, since they cost API credits.
- **Contributing:** a short CONTRIBUTING file, an issue template for "adapter broken on site X", and `good first issue` labels on adapter work.
- **Data:** publish evaluation datasets only if they contain no personal data. Otherwise publish anonymized or synthetic samples and the scripts that generate them.
- **Conventional commits and releases:** tag releases and attach a built extension zip, so testers do not need to build from source.

### Repository structure

```
job-copilot/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routes
│   │   ├── services/       # parsing, sources, matching, drafting, checking, classifiers
│   │   ├── llm/            # provider wrapper, caching
│   │   ├── prompts/        # versioned prompt templates
│   │   └── schemas/        # Pydantic models
│   ├── eval/
│   │   ├── datasets/
│   │   ├── scripts/
│   │   └── results/
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── extension/
│   ├── entrypoints/        # background, content scripts, sidepanel, dashboard, options
│   ├── adapters/           # greenhouse.ts, lever.ts, generic.ts
│   ├── lib/                # storage (Dexie), messaging, api client, field mapper
│   ├── components/         # React UI components
│   ├── tests/
│   └── wxt.config.ts
├── mock-portal/
├── docs/
├── docker-compose.yml
├── .env.example
├── LICENSE
├── CONTRIBUTING.md
└── README.md
```

**Why a monorepo:** the extension and backend share schemas and change together. One repository keeps pull requests atomic and lets contributors run everything with one clone.

---

## 14. Build order

The order is chosen so that something usable exists as early as possible and the risky parts are tested early.

| Phase | Weeks (solo, approximate) | Deliverable |
| --- | --- | --- |
| 1. Foundations | 1 to 2 | Repo, CI, schemas, resume parser, profile review screen in the side panel |
| 2. Jobs | 3 to 4 | Adzuna and Greenhouse fetchers, cache, deduplication, "Add this job" from any page |
| 3. Matching | 5 | Filters, embeddings, LLM rerank, fit reasons in the job list |
| 4. Drafting | 6 to 7 | Drafter plus fabrication checker with highlighted claims |
| 5. Filling | 8 to 9 | Greenhouse and Lever adapters, verify step, submission detection, tracker logging. **MVP complete.** |
| 6. Tracking | 10 to 11 | Gmail sync and classification, dashboard with charts, export |
| 7. Safety and polish | 12 | Scam detector, injection checks, options page, privacy policy |
| 8. Evaluation and release | 13 to 14 | Mock portal, evaluation runs, README and demo GIF, first tagged release, invite testers |

Start collecting evaluation data in phase 1. Labeling takes longer than expected, and having data early lets you measure each component as soon as it exists.

---

## 15. Decisions deliberately not taken

| Option | Why not (for now) |
| --- | --- |
| Scraping LinkedIn or Naukri | Against their terms, actively blocked, fragile, and it risks users' accounts |
| Automatic submission | Platform rules, account risk, recruiter trust, and quality |
| Storing credentials to log in on the user's behalf | A breach would expose users' professional identities; 2FA breaks it anyway |
| A user account system on the backend | Unnecessary while data stays in the browser; adds security burden |
| A hosted vector database | Data volume is far too small to justify it |
| Fine-tuning a model | Prompting with structured output and good retrieval should be measured first; fine-tune only if evaluations show a clear gap a dataset could close |
| Celery, Redis or a message queue | One scheduled job does not need a queue system |
| Firefox and Safari support at launch | Doubles testing effort before the core is stable; add Firefox after the first release |
| A vision-based browser agent as the main approach | Slower, costlier, harder to test, and more exposed to injection; possible later fallback for unknown sites |

---

## 16. Open questions

- Which Indian job sources besides Adzuna offer legitimate API access? Check whether any portal offers a partner or public API before relying on manual links for them.
- Should the maintainer run a public hosted backend, or should every user self-host with their own keys? A hosted instance is friendlier for non-developers but carries ongoing cost and responsibility.
- What is the right auto-update threshold for email classification confidence? Decide from the evaluation results, not upfront.
- Should resume versions be managed inside the extension (several tailored resumes per user), or is one profile with tailored answers enough for the first release?
