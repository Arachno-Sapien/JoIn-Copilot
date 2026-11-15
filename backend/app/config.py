from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# The repo-root .env, the same file docker compose reads. Absent inside the image, which is fine.
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # LLM Settings
    # Each user's provider (base URL, model, key) comes from the extension per request.
    JC_LLM_MODE: str = "live"  # "live" or "mock"
    JC_LLM_FIXTURES: str | None = None
    # Comma-separated provider base URLs this backend may call. Empty allows any, which
    # suits a backend only you use; set it on a shared server.
    JC_LLM_BASE_URLS: str = ""

    # Embedding Settings
    JC_EMBED_MODE: str = "model"  # "model" or "fake"
    JC_EMBED_MODEL: str = "BAAI/bge-small-en-v1.5"

    # Database and scheduler
    JC_DB_PATH: str = "data/jobs.sqlite"
    JC_SCHEDULER: str = "on"  # "on" or "off"

    # CORS
    JC_CORS_ORIGIN_REGEX: str = r"^chrome-extension://[a-p]{32}$"

    # External Provider Credentials
    ADZUNA_APP_ID: str | None = None
    ADZUNA_APP_KEY: str | None = None


settings = Settings()
