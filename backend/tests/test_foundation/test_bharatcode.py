import json
import logging

import httpx
import pytest
import respx
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.llm import bharatcode
from app.llm.bharatcode import (
    BASE_URL,
    MODEL,
    BusyError,
    KeyRejectedError,
    MissingKeyError,
    TruncatedError,
    respond,
)
from app.llm.client import acomplete
from app.main import create_app

KEY = "bc-test-key-not-real-0000"
URL = f"{BASE_URL}/responses"


def reply(text, status="completed", reason=None):
    body = {
        "status": status,
        "output": [
            {"type": "reasoning", "summary": []},
            {"type": "message", "content": [{"type": "output_text", "text": text}]},
        ],
    }
    if reason:
        body["incomplete_details"] = {"reason": reason}
    return body


@pytest.fixture
def key():
    token = bharatcode.request_key.set(KEY)
    yield KEY
    bharatcode.request_key.reset(token)


@pytest.fixture
def sleeps(monkeypatch):
    waited = []

    async def fake_sleep(seconds):
        waited.append(seconds)

    monkeypatch.setattr(bharatcode, "_sleep", fake_sleep)
    return waited


async def call(**overrides):
    args = {
        "instructions": "system text",
        "user_input": "user text",
        "schema_name": "Out",
        "json_schema": {"type": "object"},
        "max_output_tokens": 2000,
        "effort": "none",
    }
    args.update(overrides)
    return await respond(**args)


@respx.mock
async def test_sends_a_stateless_structured_request_with_the_user_key(key):
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply('{"ok": true}')))
    assert await call() == '{"ok": true}'
    sent = route.calls.last.request
    assert sent.headers["authorization"] == f"Bearer {KEY}"
    body = json.loads(sent.content)
    assert body["model"] == MODEL == "qwen-3.8-27b"
    assert body["store"] is False
    assert body["instructions"] == "system text"
    assert body["input"] == "user text"
    assert body["text"]["format"]["type"] == "json_schema"
    assert body["text"]["format"]["schema"] == {"type": "object"}
    assert body["reasoning"] == {"effort": "none"}
    assert body["max_output_tokens"] == 2000
    assert not {"tools", "tool_choice", "previous_response_id"} & body.keys()


@respx.mock
async def test_unset_effort_leaves_reasoning_to_the_model_and_budget_is_capped(key):
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply("x")))
    await call(effort=None, max_output_tokens=50000)
    body = json.loads(route.calls.last.request.content)
    assert "reasoning" not in body
    assert body["max_output_tokens"] == 32000


@respx.mock
async def test_missing_key_fails_before_any_request():
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply("x")))
    with pytest.raises(MissingKeyError) as err:
        await call()
    assert "bharatcode.ai/account" in err.value.detail
    assert route.call_count == 0


@respx.mock
async def test_busy_is_retried_after_2_4_and_8_seconds(key, sleeps):
    route = respx.post(URL).mock(
        side_effect=[httpx.Response(503)] * 3 + [httpx.Response(200, json=reply("x"))]
    )
    assert await call() == "x"
    assert sleeps == [2, 4, 8]
    assert route.call_count == 4


@respx.mock
async def test_still_busy_after_retries_raises_and_logs_the_request_id(key, sleeps, caplog):
    caplog.set_level(logging.DEBUG)
    respx.post(URL).mock(return_value=httpx.Response(503, headers={"x-request-id": "req-503"}))
    with pytest.raises(BusyError, match="busy, try again"):
        await call()
    assert sleeps == [2, 4, 8]
    assert "req-503" in caplog.text
    assert KEY not in caplog.text


@respx.mock
async def test_truncated_output_keeps_partial_text_and_is_not_retried(key, sleeps):
    route = respx.post(URL).mock(
        return_value=httpx.Response(
            200, json=reply('{"summary": "half', status="incomplete", reason="max_output_tokens")
        )
    )
    with pytest.raises(TruncatedError) as err:
        await call()
    assert err.value.partial_text == '{"summary": "half'
    assert route.call_count == 1
    assert sleeps == []


@respx.mock
async def test_rejected_key_is_reported_without_logging_the_key(key, caplog):
    caplog.set_level(logging.DEBUG)
    respx.post(URL).mock(return_value=httpx.Response(401, headers={"x-request-id": "req-401"}))
    with pytest.raises(KeyRejectedError):
        await call()
    assert "req-401" in caplog.text
    assert KEY not in caplog.text


class Answer(BaseModel):
    ok: bool


@respx.mock
async def test_the_extension_key_header_reaches_bharatcode_and_errors_explain_the_key(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("JC_LLM_MODE", "live")
    template = tmp_path / "ask.v1.md"
    template.write_text("Say ok.", encoding="utf-8")
    app = create_app()

    @app.post("/ask")
    async def ask():
        return await acomplete(template=str(template), inputs={}, schema=Answer, tier="small")

    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply('{"ok": true}')))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        missing = await client.post("/ask")
        ok = await client.post("/ask", headers={"X-BharatCode-Key": KEY})

    assert missing.status_code == 401
    assert "bharatcode.ai/account" in missing.json()["detail"]
    assert ok.status_code == 200
    assert ok.json() == {"ok": True}
    assert route.calls.last.request.headers["authorization"] == f"Bearer {KEY}"
