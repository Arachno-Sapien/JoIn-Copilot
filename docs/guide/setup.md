# Job Copilot: Setup Guide

This guide walks you through setting up Job Copilot locally for development and personal use.

## Prerequisites

- **Python 3.12+** with [uv](https://github.com/astral-sh/uv)
- **Node.js 22+** with npm
- **Google Chrome** (or Chromium-based browser supporting Manifest V3)
- (Optional) **Docker & Docker Compose** for containerized deployment

---

## 1. Backend Setup

The Job Copilot backend handles heavy computation, embeddings, and structured LLM calls. It does NOT store personal data or resumes.

```bash
cd backend

# Install dependencies and sync environment
uv sync

# Set up environment variables
cp ../.env.example ../.env   # the backend reads the repository-root .env

# Run FastAPI development server
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify backend health:
```bash
curl http://127.0.0.1:8000/health
# Response: {"status":"ok","db_ok":true}
```

---

## 2. Chrome Extension Setup

The extension is built with WXT and React.

```bash
cd extension

# Install dependencies
npm install

# Build extension for Chrome MV3
npm run build
```

This outputs the compiled unpacked extension bundle into `extension/.output/chrome-mv3`.

---

## 3. Loading the Unpacked Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/.output/chrome-mv3` folder.
5. Job Copilot will now appear in your browser toolbar! Click the extension icon to open the side panel.

---

## 4. Configuring Backend URL

1. Open the extension options page (`chrome-extension://<extension-id>/options.html` or right-click extension icon > Options).
2. Ensure **Backend Server URL** is set to `http://127.0.0.1:8000` (or your self-hosted instance).
3. Test connectivity.
