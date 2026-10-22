import json
import sys
import types

import pytest
from pydantic import BaseModel

from app.llm.client import MockLLMUnregisteredError, acomplete, complete


class DummyOutput(BaseModel):
    summary: str
    score: int


@pytest.fixture
def provider(monkeypatch):
    """Replace litellm with a recorder, so any provider call is visible and offline."""
    calls = []
    reply = json.dumps({"summary": "from provider", "score": 7})
    response = types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=reply))]
    )

    def completion(**kwargs):
        calls.append(("completion", kwargs))
        return response

    async def acompletion(**kwargs):
        calls.append(("acompletion", kwargs))
        return response

    module = types.ModuleType("litellm")
    module.completion = completion
    module.acompletion = acompletion
    monkeypatch.setitem(sys.modules, "litellm", module)
    return calls


@pytest.fixture
def live_mode(monkeypatch, tmp_path):
    monkeypatch.setenv("JC_LLM_MODE", "live")
    monkeypatch.setenv("JC_LLM_SMALL_MODEL", "provider/small-test")
    monkeypatch.setenv("JC_LLM_STRONG_MODEL", "provider/strong-test")
    template = tmp_path / "rank.v1.md"
    template.write_text(
        "---\nuntrusted:\n  - job\n---\nsystem:\nRank the job.\nuser:\n{{ job }}\n", encoding="utf-8"
    )
    return str(template)


def test_mock_llm_returns_registered_fake(fake_llm, provider):
    fake_llm.register(
        template="test_template.v1",
        inputs={"query": "hello"},
        output=DummyOutput(summary="Test response", score=10),
    )
    result = complete(template="test_template.v1", inputs={"query": "hello"}, schema=DummyOutput, tier="small")
    assert result == DummyOutput(summary="Test response", score=10)
    assert provider == []


def test_unregistered_call_raises_without_touching_the_provider_or_echoing_inputs(provider):
    with pytest.raises(MockLLMUnregisteredError) as err:
        complete(
            template="unregistered_template.v1",
            inputs={"resume": "PRIVATE-RESUME-TEXT"},
            schema=DummyOutput,
            tier="small",
        )
    assert provider == []
    assert "PRIVATE-RESUME-TEXT" not in str(err.value)


def test_mock_llm_serves_fixtures_file(tmp_path, monkeypatch, provider):
    fixtures_file = tmp_path / "fixtures.json"
    fixtures_file.write_text(json.dumps({
        "file_template.v1": {
            json.dumps({"text": "sample"}, sort_keys=True): {"summary": "From fixture file", "score": 99}
        }
    }))
    monkeypatch.setenv("JC_LLM_FIXTURES", str(fixtures_file))
    result = complete(template="file_template.v1", inputs={"text": "sample"}, schema=DummyOutput, tier="small")
    assert result == DummyOutput(summary="From fixture file", score=99)
    assert provider == []


@pytest.mark.parametrize("content", [
    "{not json",
    json.dumps({"file_template.v1": {json.dumps({"text": "sample"}, sort_keys=True): {"summary": 1}}}),
])
def test_broken_fixture_file_fails_loudly_instead_of_looking_unregistered(tmp_path, monkeypatch, content):
    fixtures_file = tmp_path / "fixtures.json"
    fixtures_file.write_text(content)
    monkeypatch.setenv("JC_LLM_FIXTURES", str(fixtures_file))
    with pytest.raises(ValueError):
        complete(template="file_template.v1", inputs={"text": "sample"}, schema=DummyOutput, tier="small")


def test_missing_fixture_file_fails_loudly(tmp_path, monkeypatch):
    monkeypatch.setenv("JC_LLM_FIXTURES", str(tmp_path / "absent.json"))
    with pytest.raises(FileNotFoundError):
        complete(template="file_template.v1", inputs={"text": "sample"}, schema=DummyOutput, tier="small")


async def test_acomplete_serves_registered_fakes(fake_llm, provider):
    fake_llm.register(template="async.v1", inputs={"q": 1}, output={"summary": "async", "score": 3})
    result = await acomplete(template="async.v1", inputs={"q": 1}, schema=DummyOutput, tier="small")
    assert result == DummyOutput(summary="async", score=3)
    assert provider == []


async def test_acomplete_awaits_the_async_provider_call_without_tools(live_mode, provider):
    result = await acomplete(template=live_mode, inputs={"job": "Backend role"}, schema=DummyOutput, tier="small")
    assert result == DummyOutput(summary="from provider", score=7)
    assert [name for name, _ in provider] == ["acompletion"]
    kwargs = provider[0][1]
    assert kwargs["model"] == "provider/small-test"
    assert not {"tools", "tool_choice", "functions", "function_call"} & kwargs.keys()


def test_complete_uses_the_sync_provider_call_without_tools(live_mode, provider):
    result = complete(template=live_mode, inputs={"job": "Backend role"}, schema=DummyOutput, tier="strong")
    assert result.summary == "from provider"
    assert [name for name, _ in provider] == ["completion"]
    assert provider[0][1]["model"] == "provider/strong-test"
    assert not {"tools", "tool_choice", "functions", "function_call"} & provider[0][1].keys()
