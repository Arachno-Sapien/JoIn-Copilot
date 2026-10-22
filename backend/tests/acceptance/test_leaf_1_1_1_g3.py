import json

import httpx
import pytest
import respx
from pydantic import BaseModel

from app.llm import bharatcode
from app.llm.client import MockLLMUnregisteredError, acomplete, complete

URL = f"{bharatcode.BASE_URL}/responses"
REPLY = {
    "status": "completed",
    "output": [{"type": "message", "content": [{"type": "output_text", "text": '{"summary": "from provider", "score": 7}'}]}],
}
FORBIDDEN = {"tools", "tool_choice", "functions", "function_call", "previous_response_id"}


class DummyOutput(BaseModel):
    summary: str
    score: int


@pytest.fixture
def provider():
    """Mock BharatCode, so any provider call is visible and offline."""
    with respx.mock(assert_all_called=False) as mock:
        yield mock.post(URL).mock(return_value=httpx.Response(200, json=REPLY))


@pytest.fixture
def live_mode(monkeypatch, tmp_path):
    monkeypatch.setenv("JC_LLM_MODE", "live")
    token = bharatcode.request_key.set("test-key-not-real")
    template = tmp_path / "rank.v1.md"
    template.write_text(
        "---\nuntrusted:\n  - job\n---\nsystem:\nRank the job.\nuser:\n{{ job }}\n", encoding="utf-8"
    )
    yield str(template)
    bharatcode.request_key.reset(token)


def sent(route):
    request = route.calls.last.request
    return request, json.loads(request.content)


def test_mock_llm_returns_registered_fake(fake_llm, provider):
    fake_llm.register(
        template="test_template.v1",
        inputs={"query": "hello"},
        output=DummyOutput(summary="Test response", score=10),
    )
    result = complete(template="test_template.v1", inputs={"query": "hello"}, schema=DummyOutput, tier="small")
    assert result == DummyOutput(summary="Test response", score=10)
    assert provider.call_count == 0


def test_unregistered_call_raises_without_touching_the_provider_or_echoing_inputs(provider):
    with pytest.raises(MockLLMUnregisteredError) as err:
        complete(
            template="unregistered_template.v1",
            inputs={"resume": "PRIVATE-RESUME-TEXT"},
            schema=DummyOutput,
            tier="small",
        )
    assert provider.call_count == 0
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
    assert provider.call_count == 0


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
    assert provider.call_count == 0


async def test_acomplete_asks_bharatcode_for_structured_output_without_tools(live_mode, provider):
    result = await acomplete(template=live_mode, inputs={"job": "Backend role"}, schema=DummyOutput, tier="small")
    assert result == DummyOutput(summary="from provider", score=7)
    request, body = sent(provider)
    assert request.headers["authorization"] == "Bearer test-key-not-real"
    assert body["model"] == "qwen-3.8-27b"
    assert body["store"] is False
    assert body["text"]["format"]["type"] == "json_schema"
    assert body["text"]["format"]["schema"]["properties"].keys() == {"summary", "score"}
    assert "<untrusted_data>" in body["input"]
    assert not FORBIDDEN & body.keys()


def test_complete_takes_the_same_path(live_mode, provider):
    result = complete(template=live_mode, inputs={"job": "Backend role"}, schema=DummyOutput, tier="strong")
    assert result.summary == "from provider"
    assert provider.call_count == 1
    assert not FORBIDDEN & sent(provider)[1].keys()
