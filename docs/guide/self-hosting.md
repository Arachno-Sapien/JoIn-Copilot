# Self-hosting the backend

You can run the Job Copilot backend on your own server instead of your laptop. Personal data still stays in each user's browser: the backend keeps only public job postings, and every AI request uses the AI provider and key of the person who sent it.

## Run it with Docker Compose

```bash
git clone https://github.com/Arachno-Sapien/JoIn-Copilot.git
cd JoIn-Copilot
cp .env.example .env
docker compose up -d
```

No AI key goes in `.env`. Each user enters their own AI provider and key on the extension's options page.

On a backend other people can reach, set `JC_LLM_BASE_URLS` in `.env` to the providers you allow, for example `JC_LLM_BASE_URLS=https://api.openai.com/v1,https://openrouter.ai/api/v1`. Otherwise anyone who can reach the backend can make it send requests to any URL, including addresses inside your network.

The backend listens on port 8000 on the server's loopback address only. Check it on the server with `curl http://127.0.0.1:8000/health`, which should answer `{"status":"ok"}`, then reach it from other machines through the HTTPS proxy below.

## Put it behind HTTPS

If the backend runs on another machine, put it behind a reverse proxy with HTTPS, such as Caddy, Nginx or a Cloudflare Tunnel. With Caddy:

```caddy
copilot-api.yourdomain.com {
    reverse_proxy 127.0.0.1:8000
}
```

Then open the extension's options page, set **Backend URL** to `https://copilot-api.yourdomain.com` and click **Save Settings**.
