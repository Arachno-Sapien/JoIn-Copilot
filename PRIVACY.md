# Privacy Policy for Job Copilot

**Last updated:** October 18, 2026

Job Copilot is an open-source, local-first AI job search assistant. Our architecture is designed around one core principle: **the user's browser is the trust boundary**.

---

## 1. Where Your Data Lives

- **Personal Profile, Resumes & Work History:** Stored exclusively in your browser via IndexedDB (Dexie.js).
- **Application History & Recruiter Emails:** Stored exclusively in your browser via IndexedDB.
- **Passwords & Credentials:** Never requested, never accessed, and never stored.
- **Backend Database:** The backend SQLite database stores only publicly accessible job postings. It contains zero user accounts, zero profiles, and zero personal identifiers.

---

## 2. What Leaves Your Browser

When you interact with Job Copilot features:

1. **Resume Parsing & Profile Generation:**
   - When you upload a resume, its plain text is sent to the configured backend endpoint (`/profile/parse`) to extract structured fields.
   - The backend processes the text in memory and streams it to the designated LLM provider.
   - The backend never logs request bodies and never saves resume text to disk or database.

2. **Job Search & Matching:**
   - Your profile's job search preferences (skills, titles, location preferences) are sent to `/jobs/search` to retrieve matching jobs.
   - Candidate rankings and fit scores are calculated in memory and returned to your browser.

3. **Application Answer Drafting:**
   - When you request a drafted answer, the question, job description, and relevant resume bullet points are sent to `/draft`.
   - The response is generated and verified for hallucinations against your resume.
   - No draft content is retained on the backend after the HTTP response completes.

4. **Recruiter Email Classification (Optional):**
   - If Gmail sync is enabled, email snippet headers and text are fetched directly into your browser via Google OAuth.
   - Classification requests sent to `/email/classify` process email snippets in memory to detect application status updates (e.g. interview invite, rejection).
   - Email content is never logged or stored on the backend.

---

## 3. Telemetry & Analytics

- **No Remote Telemetry:** Job Copilot does not include Google Analytics, Mixpanel, Sentry, or third-party trackers.
- **Export & Deletion:** You can export all your data anytime (in JSON and RFC 4180 CSV formats) or permanently delete all local data with a single click in the extension Options page.

---

## 4. Open Source & Auditability

Job Copilot is 100% open source under the MIT License. You can inspect every line of code, build the extension bundle from source, and self-host the backend on your own hardware.
