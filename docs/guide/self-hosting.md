# Self-Hosting Job Copilot

Job Copilot is designed with a **browser-local trust boundary**:
- All personal data (profile, resumes, application history, notes) is stored strictly in your browser's IndexedDB.
- The backend server is stateless regarding personal data; it caches public job postings only and processes model inference in memory.

## Docker Compose Deployment

You can self-host the backend on any virtual private server (VPS), home lab, or local machine using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/user/job-copilot.git
cd job-copilot

# Configure environment variables
cp .env.example .env
# Edit .env with your LLM API keys (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY, or local Ollama URL)

# Start services
docker compose up -d
```

The backend will be available on port `8000`.

## Reverse Proxy & HTTPS

For remote hosting, put the backend behind a reverse proxy (e.g., Caddy, Nginx, or Cloudflare Tunnel) with HTTPS:

```caddy
copilot-api.yourdomain.com {
    reverse_proxy 127.0.0.1:8000
}
```

Then in your extension options page, point the Backend URL to `https://copilot-api.yourdomain.com`.
