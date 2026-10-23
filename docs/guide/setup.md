# Setup guide

This guide gets Job Copilot running on your computer: the backend, the Chrome extension and your BharatCode key.

## Quick setup on Windows

Double-click `setup.bat` in the project folder. It:

- checks for Google Chrome, uv and Node.js 22, and offers to install uv or Node.js with winget if they're missing
- creates `.env` from `.env.example` if you don't have one
- sets up the backend (uv downloads Python 3.12 if needed) and builds the extension
- prints how to load the extension and add your key, and can start the backend for you

If it installs anything, close the window and run it again so Windows can find the new tools. When it finishes, follow the steps it prints, which match steps 3 and 4 below. If it stops with an error, or you're not on Windows, use the manual steps below.

## What you need

- Python 3.12 and [uv](https://docs.astral.sh/uv/)
- Node.js 22 and npm
- Google Chrome
- A BharatCode API key (step 4 shows how to get one)
- Docker, only if you want to run the backend in a container

## 1. Start the backend

The backend extracts resume text, ranks jobs and calls BharatCode for the extension. It stores no personal data.

From the repository root:

```bash
cp .env.example .env
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend reads `.env` from the repository root. You don't need to change anything in it, and no AI key goes in it.

Check that the backend is running:

```bash
curl http://127.0.0.1:8000/health
```

It should answer `{"status":"ok"}`.

To use Docker instead, run `docker compose up -d backend` from the repository root.

## 2. Build the extension

In a second terminal, from the repository root:

```bash
cd extension
npm install
npm run build
```

The built extension goes to `extension/.output/chrome-mv3`.

## 3. Load the extension in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and choose the `extension/.output/chrome-mv3` folder.

Job Copilot now appears in the toolbar. Click its icon to open the side panel.

## 4. Add your BharatCode key

1. Get a key at [bharatcode.ai/account](https://bharatcode.ai/account). It is free for students who verify an `.ac.in` or `.edu.in` email. The Lite and Pro plans also include API access.
2. Right-click the Job Copilot icon and choose **Options**.
3. Paste the key, click **Store key**, then click **Test connection**.

If you see "Connected. Your key can use qwen-3.8-27b.", you're done. If it says your account has no API access yet, finish the student email verification or choose a plan at bharatcode.ai/account, then test again.

## 5. Point the extension at your backend

The extension expects the backend at `http://127.0.0.1:8000`. If yours runs somewhere else, change **Backend URL** on the options page and click **Save Settings**.
