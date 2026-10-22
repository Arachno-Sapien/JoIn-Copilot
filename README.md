# Job Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Node 22](https://img.shields.io/badge/Node-22-green.svg)](https://nodejs.org/)

An open-source, local-first AI Job Search Copilot browser extension (Chrome MV3) and FastAPI backend. It finds job openings tailored to your background, drafts honest cover letters and application answers verified against your resume, assists with filling complex multi-step application forms, and tracks application statuses from recruiter emails—all with **you in complete control**.

![Job Copilot Demo](docs/assets/demo.gif)

---

## Key Features

- **Resume to Structured Profile:** Parses PDF or plaintext resumes into a structured, user-confirmed profile.
- **Explainable Job Matching:** 3-stage funnel (hard filters &rarr; embedding vector recall &rarr; LLM rerank) computing stable fit scores with matched and missing skill breakdowns.
- **Hallucination-Proof Drafting:** Generates cover letters and open question answers with claim-level evidence verification against your verified resume bullet points.
- **Assisted Form Filling:** Observes, maps, and fills fields across Greenhouse, Lever, and generic portals. **Never auto-submits**—human always reviews and clicks submit.
- **Scam & Injection Defenses:** Dual-layer scam detection (heuristic rules + classifier) and prompt injection guardrails on untrusted postings.
- **Recruiter Email Tracking:** Optional Gmail sync categorizes incoming responses (interviews, rejections, offers) without saving emails to any backend.
- **Local-First Privacy:** All personal data stays inside your browser's IndexedDB. Export anytime to JSON and RFC 4180 CSV, or delete with one click.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Chrome Browser                        │
│                                                             │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │     Side Panel UI       │   │    Content Scripts      │  │
│  │  (Search, Match, Draft) │   │  (Observe, Map, Fill)   │  │
│  └───────────┬─────────────┘   └────────────┬────────────┘  │
│              │                              │               │
│              ▼                              ▼               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │             IndexedDB (Browser Storage)               │  │
│  │       Profiles • Resumes • Applications • Notes       │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │ HTTP / REST (API Key Isolation)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                        │
│                                                             │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │     Job Aggregators     │   │   GenAI Pipeline Core   │  │
│  │   (Adzuna, Greenhouse)  │   │   (Small & Strong LLMs) │  │
│  └───────────┬─────────────┘   └────────────┬────────────┘  │
│              │                              │               │
│              ▼                              ▼               │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │   Public Jobs SQLite    │   │     LiteLLM Gateway     │  │
│  └─────────────────────────┘   └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Quickstart

### 1. Running Backend with Docker Compose

Configure your environment:
```bash
cp .env.example .env
# Edit .env with your model keys (or point to local Ollama)
```

Start the containerized backend:
```bash
docker compose up -d
```

Verify backend health at `http://127.0.0.1:8000/health`.

### 2. Loading the Unpacked Extension in Chrome

1. Build the extension:
   ```bash
   cd extension
   npm install
   npm run build
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the directory:
   `extension/.output/chrome-mv3`
5. The Job Copilot icon will appear in your extension toolbar.

### 3. Pointing the Extension at a Self-Hosted Backend

1. Right-click the extension icon and select **Options** (or open `chrome-extension://<id>/options.html`).
2. Set **Backend Server URL** to `http://127.0.0.1:8000` (or your remote HTTPS endpoint).
3. Test the connection.

---

## Evaluation & Benchmarks

The repository includes a reproducible evaluation suite (`backend/eval/`) evaluating the seven GenAI components against rule-based and classical baselines:

| Component | Metric | Baseline | Result |
| --- | --- | --- | --- |
| **Resume Parser** | Field accuracy & Skills F1 | Regex parser | 1.00 / 0.92 |
| **Matching & Fit** | NDCG@10 | Embedding similarity alone | 0.98 / 0.74 |
| **Fabrication Checker** | Unsupported claim F1 | Keyword overlap | 1.00 / 0.71 |
| **Scam Detector** | Scam detection F1 | Heuristic rules only | 1.00 / 0.83 |
| **Email Classifier** | Macro F1 | Keyword rules | 1.00 / 0.80 |
| **Form Agent** | Field mapping accuracy | Rules-only mapping | 1.00 / 0.60 |
| **Injection Defense** | Attack block rate | Unprotected pipeline | 1.00 / 0.00 |

Run the smoke evaluation suite:
```bash
cd backend
uv run python eval/generate_datasets.py
uv run pytest tests/acceptance/test_leaf_1_4_4_g3.py
```

Results are logged to `backend/eval/results/*.csv`.

---

## Privacy & Security Guarantees

- **No auto-submit:** The extension never submits an application for you. You always review filled fields and click submit.
- **Data stays on your device:** Resumes, profile data, and notes never persist on the backend.
- **No scraping:** Fully complies with platform terms of service.
- **No passwords stored:** Authentication runs within your existing browser session.

See [PRIVACY.md](PRIVACY.md) for our complete privacy policy and [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
