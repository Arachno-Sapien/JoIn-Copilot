# Setup guide

This guide gets Job Copilot running on your computer: the backend, the Chrome extension and your AI provider.

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
- An AI provider: an API key for any OpenAI-compatible service, or a local model server such as Ollama (step 4 covers both)
- Docker, only if you want to run the backend in a container

## 1. Start the backend

The backend extracts resume text, ranks jobs and calls your AI provider for the extension. It stores no personal data.

From the repository root:

```bash
cp .env.example .env
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend reads `.env` from the repository root, and no AI key goes in it. To find jobs, list job sources in it first, for example `JC_GREENHOUSE_BOARDS=stripe,airbnb` or `JC_LEVER_COMPANIES=netflix`. The README's [Job sources](../../README.md#job-sources) section lists every setting. The backend fetches them a few seconds after it starts and then daily.

The first time it ranks jobs, the backend downloads its embedding model, so that search takes longer. Without internet access it falls back to a simpler word match.

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

## 4. Set up your AI provider

1. Choose a provider that speaks the OpenAI chat completions format, and a model on it that supports structured (JSON schema) output. For example, OpenAI (`https://api.openai.com/v1`), OpenRouter (`https://openrouter.ai/api/v1`) or Ollama on your computer (`http://localhost:11434/v1`, no key needed). If the backend runs in Docker, use `http://host.docker.internal:11434/v1` for Ollama. The backend calls only https providers and providers on its own computer, so for a model server elsewhere on your network, add its base URL to `JC_LLM_BASE_URLS` in `.env`.
2. Right-click the Job Copilot icon and choose **Options**.
3. Under **AI provider**, enter the base URL, the model id and your key, if the provider needs one. Click **Store provider**, then click **Test connection**.

If you see "Connected. <your model> answered with structured output.", you're done. Otherwise the message shows what the provider said, such as a rejected key or an unknown model.

## 5. Point the extension at your backend

The extension expects the backend at `http://127.0.0.1:8000`. If yours runs somewhere else, change **Backend URL** on the options page and click **Save Settings**.

## 6. (Optional) Set up Gmail sync

To enable automated application status updates from confirmation and interview emails, set up a Google OAuth client ID:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the **Gmail API**.
2. Configure the OAuth consent screen with the single scope `https://www.googleapis.com/auth/gmail.readonly`.
3. Create an OAuth client of type **Chrome Extension** using the extension's ID from `chrome://extensions`.
4. Set `WXT_GOOGLE_CLIENT_ID` to that client ID (in your shell, or in a file named `.env` inside `extension/`; the `.env` in the project root is for the backend only) and rebuild the extension (`npm run build`).

> [!NOTE]
> The extension ID changes with the directory it is loaded from unless the manifest has a fixed `key`. Do not commit or add a private key or client secret.
