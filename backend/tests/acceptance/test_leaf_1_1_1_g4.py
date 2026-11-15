import re
from pathlib import Path

import httpx
import pytest
import respx
from pydantic import BaseModel

from app.llm import provider
from app.llm.client import complete, get_model_for_tier

APP_DIR = Path(__file__).resolve().parents[2] / "app"

# Provider-prefixed ids ("openai/...") and bare model families.
HARD_CODED_MODEL = re.compile(
    r"""["'](?:openai|anthropic|ollama|gemini|groq|mistral|cohere|azure|bedrock|vertex_ai|together_ai|deepseek)/"""
    r"""|\b(?:gpt-[0-9][\w.-]*|o[134]-(?:mini|preview)[\w.-]*|claude-[\w.-]+|gemini-[0-9][\w.-]*"""
    r"""|llama-?[0-9][\w.-]*|mistral-[\w.-]+|qwen-?[0-9][\w.-]*|phi-?[0-9][\w.-]*|deepseek-[\w.-]+)\b""",
    re.IGNORECASE,
)


class Out(BaseModel):
    ok: bool


def test_the_pattern_catches_known_model_ids():
    for sample in ['"openai/gpt-4o-mini"', "gpt-4o", "claude-3-5-sonnet", "llama3.1", "qwen-3.8-27b",
                   "deepseek-v4.1-flash"]:
        assert HARD_CODED_MODEL.search(sample), sample


def test_no_model_id_is_hard_coded_under_app():
    # Each user picks the model in the extension options.
    files = list(APP_DIR.rglob("*.py"))
    assert files, "no Python files found under backend/app"
    hits = []
    for py_file in files:
        for idx, line in enumerate(py_file.read_text(encoding="utf-8").splitlines(), start=1):
            if line.strip().startswith("#"):
                continue
            for match in HARD_CODED_MODEL.finditer(line):
                hits.append(f"{py_file.name}:{idx} {match.group(0)}")
    assert not hits, f"hard-coded model ids under backend/app: {hits}"


def test_both_tiers_use_the_users_model():
    token = provider.request_connection.set(provider.Connection("https://llm.example.test/v1", "user-model"))
    try:
        assert get_model_for_tier("small") == get_model_for_tier("strong") == "user-model"
    finally:
        provider.request_connection.reset(token)


@pytest.mark.parametrize("tier", ["smal", "large", "", "STRONG"])
def test_unknown_tier_is_rejected(tier):
    with pytest.raises(ValueError):
        get_model_for_tier(tier)


@respx.mock
def test_live_call_without_a_provider_fails_before_any_request(monkeypatch, tmp_path):
    route = respx.route().mock(return_value=httpx.Response(200))
    monkeypatch.setenv("JC_LLM_MODE", "live")
    template = tmp_path / "t.v1.md"
    template.write_text("Say ok.", encoding="utf-8")

    with pytest.raises(provider.NotConfiguredError):
        complete(template=str(template), inputs={}, schema=Out, tier="small")
    assert route.call_count == 0
