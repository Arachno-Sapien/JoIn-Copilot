import re
import sys
import types
from pathlib import Path

import pytest
from pydantic import BaseModel

from app.config import settings
from app.llm.client import complete, get_model_for_tier

APP_DIR = Path(__file__).resolve().parents[2] / "app"

# Provider-prefixed ids ("openai/...") and bare model families.
HARD_CODED_MODEL = re.compile(
    r"""["'](?:openai|anthropic|ollama|gemini|groq|mistral|cohere|azure|bedrock|vertex_ai|together_ai|deepseek)/"""
    r"""|\b(?:gpt-[0-9][\w.-]*|o[134]-(?:mini|preview)[\w.-]*|claude-[\w.-]+|gemini-[0-9][\w.-]*"""
    r"""|llama-?[0-9][\w.-]*|mistral-[\w.-]+|qwen[0-9][\w.-]*|phi-?[0-9][\w.-]*|deepseek-[\w.-]+)\b""",
    re.IGNORECASE,
)


class Out(BaseModel):
    ok: bool


def test_the_pattern_catches_known_model_ids():
    for sample in ['"openai/gpt-4o-mini"', "gpt-4o", "claude-3-5-sonnet", "llama3.1", "'ollama/qwen2'"]:
        assert HARD_CODED_MODEL.search(sample), sample


def test_no_hardcoded_model_ids_in_app():
    files = list(APP_DIR.rglob("*.py"))
    assert files, "no Python files found under backend/app"
    hits = []
    for py_file in files:
        for idx, line in enumerate(py_file.read_text(encoding="utf-8").splitlines(), start=1):
            if line.strip().startswith("#"):
                continue
            match = HARD_CODED_MODEL.search(line)
            if match:
                hits.append(f"{py_file.name}:{idx} {match.group(0)}")
    assert not hits, f"hard-coded model ids under backend/app: {hits}"


def test_model_names_come_from_config(monkeypatch):
    monkeypatch.setattr(settings, "JC_LLM_SMALL_MODEL", "provider/custom-small-model")
    monkeypatch.setattr(settings, "JC_LLM_STRONG_MODEL", "provider/custom-strong-model")
    monkeypatch.delenv("JC_LLM_SMALL_MODEL", raising=False)
    monkeypatch.delenv("JC_LLM_STRONG_MODEL", raising=False)
    assert get_model_for_tier("small") == "provider/custom-small-model"
    assert get_model_for_tier("strong") == "provider/custom-strong-model"


@pytest.mark.parametrize("tier", ["smal", "large", "", "STRONG"])
def test_unknown_tier_is_rejected(tier):
    with pytest.raises(ValueError):
        get_model_for_tier(tier)


def test_live_call_without_a_configured_model_fails_before_reaching_the_provider(monkeypatch, tmp_path):
    calls = []
    module = types.ModuleType("litellm")
    module.completion = lambda **kwargs: calls.append(kwargs)
    monkeypatch.setitem(sys.modules, "litellm", module)
    monkeypatch.setenv("JC_LLM_MODE", "live")
    monkeypatch.setenv("JC_LLM_SMALL_MODEL", "")
    monkeypatch.setattr(settings, "JC_LLM_SMALL_MODEL", "")
    template = tmp_path / "t.v1.md"
    template.write_text("Say ok.", encoding="utf-8")

    with pytest.raises(ValueError, match="JC_LLM_SMALL_MODEL"):
        complete(template=str(template), inputs={}, schema=Out, tier="small")
    assert calls == []
