from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# The repo-root .env, the same file docker compose reads. Absent inside the image, which is fine.
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # LLM Settings
    # The model is fixed (app/llm/bharatcode.py) and the key comes from the extension.
    JC_LLM_MODE: str = "live"  # "live" or "mock"
    JC_LLM_FIXTURES: str | None = None

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
