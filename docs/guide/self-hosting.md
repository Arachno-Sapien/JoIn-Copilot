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

On a backend other people can reach, set `JC_LLM_BASE_URLS` in `.env` to the providers you allow, for example `JC_LLM_BASE_URLS=https://api.openai.com/v1,https://openrouter.ai/api/v1`. Without it the backend calls any https provider on the internet and any provider on the server itself (`localhost`, `host.docker.internal`). It refuses private and cloud metadata addresses, but a host name can still be pointed at one between its check and the call, and services on the server itself stay reachable. A provider on your own network, such as an Ollama on another machine, works only once you list it here.

The backend listens on port 8000 on the server's loopback address only. Check it on the server with `curl http://127.0.0.1:8000/health`, which should answer `{"status":"ok"}`, then reach it from other machines through the HTTPS proxy below.

## Put it behind HTTPS

If the backend runs on another machine, put it behind a reverse proxy with HTTPS, such as Caddy, Nginx or a Cloudflare Tunnel. With Caddy:

```caddy
copilot-api.yourdomain.com {
    reverse_proxy 127.0.0.1:8000
}
```

Then open the extension's options page, set **Backend URL** to `https://copilot-api.yourdomain.com` and click **Save Settings**.
