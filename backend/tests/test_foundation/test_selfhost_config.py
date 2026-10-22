import json
import re
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[3]
COMPOSE = yaml.safe_load((REPO / "docker-compose.yml").read_text(encoding="utf-8"))["services"]["backend"]
DOCKERFILE = (REPO / "backend" / "Dockerfile").read_text(encoding="utf-8")


def test_compose_loads_the_optional_env_file_for_provider_keys():
    entries = COMPOSE.get("env_file", [])
    entries = entries if isinstance(entries, list) else [entries]
    paths = [e["path"] if isinstance(e, dict) else e for e in entries]
    assert ".env" in paths
    assert all(e.get("required") is False for e in entries if isinstance(e, dict) and e.get("path") == ".env")


def test_compose_defaults_to_live_mode_and_hard_codes_no_model():
    env = COMPOSE["environment"]
    assert ":-mock" not in str(env.get("JC_LLM_MODE", ""))
    for name in ("JC_LLM_SMALL_MODEL", "JC_LLM_STRONG_MODEL"):
        assert name in env
        assert not re.search(r":-\s*[^}\s]", str(env[name])), f"{name} has a hard-coded default model"


def test_container_starts_without_installing_dev_dependencies():
    cmd = json.loads(re.search(r"^CMD\s+(\[.*\])\s*$", DOCKERFILE, re.MULTILINE).group(1))
    assert cmd[:2] != ["uv", "run"] or "--no-dev" in cmd, cmd


def test_local_runs_read_the_same_repo_root_env_file_as_docker():
    from app.config import Settings

    assert Path(Settings.model_config["env_file"]) == REPO / ".env"


def test_uv_image_is_pinned():
    assert "astral-sh/uv:latest" not in DOCKERFILE
    assert re.search(r"ghcr\.io/astral-sh/uv:\d+\.\d+\.\d+", DOCKERFILE)
