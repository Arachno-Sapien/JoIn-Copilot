FROM python:3.12-slim

WORKDIR /app

# Install a pinned uv
COPY --from=ghcr.io/astral-sh/uv:0.11.23 /uv /uvx /bin/

# Install locked runtime dependencies only, before copying code for better layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# Copy application code
COPY app ./app

ENV PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

# Run the locked environment directly: uv never syncs or installs anything at startup.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
