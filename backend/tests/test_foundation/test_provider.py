import json
import logging

import httpx
import pytest
import respx
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.config import settings
from app.llm import provider
from app.llm.client import acomplete
from app.llm.provider import (
    BusyError,
    Connection,
    KeyRejectedError,
    NotConfiguredError,
    ProviderNotAllowedError,
    RequestFailedError,
    TruncatedError,
    respond,
)
from app.main import create_app

BASE_URL = "https://llm.example.test/v1"
MODEL = "example-model"
KEY = "test-key-not-real-0000"
URL = f"{BASE_URL}/chat/completions"
HEADERS = {"X-LLM-Base-URL": BASE_URL, "X-LLM-Model": MODEL, "X-LLM-Key": KEY}


def reply(text, finish_reason="stop"):
    return {"choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": finish_reason}]}


@pytest.fixture
def conn():
    token = provider.request_connection.set(Connection(BASE_URL, MODEL, KEY))
    yield
    provider.request_connection.reset(token)


@pytest.fixture
def sleeps(monkeypatch):
    waited = []

    async def fake_sleep(seconds):
        waited.append(seconds)

    monkeypatch.setattr(provider, "_sleep", fake_sleep)
    return waited


async def call(**overrides):
    args = {"instructions": "system text", "user_input": "user text", "schema_name": "Out", "json_schema": {"type": "object"}}
    args.update(overrides)
    return await respond(**args)


@respx.mock
async def test_sends_a_structured_chat_completion_with_the_user_key(conn):
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply('{"ok": true}')))
    assert await call() == '{"ok": true}'
    sent = route.calls.last.request
    assert sent.headers["authorization"] == f"Bearer {KEY}"
    body = json.loads(sent.content)
    assert body["model"] == MODEL
    assert body["messages"] == [
        {"role": "system", "content": "system text"},
        {"role": "user", "content": "user text"},
    ]
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["schema"] == {"type": "object"}
    assert not {"tools", "tool_choice", "functions", "function_call"} & body.keys()


@respx.mock
async def test_a_provider_without_a_key_gets_no_authorization_header():
    # Local servers such as Ollama or LM Studio need no key.
    token = provider.request_connection.set(Connection(BASE_URL + "/", MODEL, None))
    try:
        route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply("x")))
        assert await call() == "x"
    finally:
        provider.request_connection.reset(token)
    assert "authorization" not in route.calls.last.request.headers


@pytest.mark.parametrize("connection", [Connection(), Connection(BASE_URL, None, KEY), Connection(None, MODEL, KEY)])
@respx.mock
async def test_missing_base_url_or_model_fails_before_any_request(connection):
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply("x")))
    token = provider.request_connection.set(connection)
    try:
        with pytest.raises(NotConfiguredError) as err:
            await call()
    finally:
        provider.request_connection.reset(token)
    assert "extension options" in err.value.detail
    assert route.call_count == 0


@respx.mock
async def test_a_base_url_outside_the_allowlist_is_never_called(conn, monkeypatch):
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply("x")))
    monkeypatch.setattr(settings, "JC_LLM_BASE_URLS", "https://api.openai.com/v1, http://localhost:11434/v1")
    with pytest.raises(ProviderNotAllowedError):
        await call()
    assert route.call_count == 0

    monkeypatch.setattr(settings, "JC_LLM_BASE_URLS", f"https://api.openai.com/v1,{BASE_URL}/")
    assert await call() == "x"


@respx.mock
async def test_a_stalled_reply_is_not_blamed_on_the_connection(conn):
    respx.post(URL).mock(side_effect=httpx.ReadTimeout("no bytes"))
    with pytest.raises(RequestFailedError, match="took too long") as err:
        await call()
    assert "reach" not in str(err.value)


@respx.mock
async def test_unreachable_provider_points_at_the_base_url(conn):
    respx.post(URL).mock(side_effect=httpx.ConnectError("refused"))
    with pytest.raises(RequestFailedError, match="base URL"):
        await call()


@pytest.mark.parametrize("status", [429, 503])
@respx.mock
async def test_busy_or_rate_limited_is_retried_after_2_4_and_8_seconds(conn, sleeps, status):
    route = respx.post(URL).mock(side_effect=[httpx.Response(status)] * 3 + [httpx.Response(200, json=reply("x"))])
    assert await call() == "x"
    assert sleeps == [2, 4, 8]
    assert route.call_count == 4


@respx.mock
async def test_still_busy_after_retries_raises_and_logs_the_request_id(conn, sleeps, caplog):
    caplog.set_level(logging.DEBUG)
    respx.post(URL).mock(return_value=httpx.Response(503, headers={"x-request-id": "req-503"}))
    with pytest.raises(BusyError, match="busy"):
        await call()
    assert sleeps == [2, 4, 8]
    assert "req-503" in caplog.text
    assert KEY not in caplog.text


@respx.mock
async def test_truncated_output_keeps_partial_text_and_is_not_retried(conn, sleeps):
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply('{"summary": "half', "length")))
    with pytest.raises(TruncatedError) as err:
        await call()
    assert err.value.partial_text == '{"summary": "half'
    assert route.call_count == 1
    assert sleeps == []


@pytest.mark.parametrize("body", [{"choices": []}, {"error": "x"}, reply(None), reply("")])
@respx.mock
async def test_a_reply_without_an_answer_is_reported(conn, body):
    respx.post(URL).mock(return_value=httpx.Response(200, json=body))
    with pytest.raises(RequestFailedError):
        await call()


@respx.mock
async def test_rejected_key_is_reported_without_logging_the_key(conn, caplog):
    caplog.set_level(logging.DEBUG)
    respx.post(URL).mock(return_value=httpx.Response(401, headers={"x-request-id": "req-401"}))
    with pytest.raises(KeyRejectedError):
        await call()
    assert "req-401" in caplog.text
    assert KEY not in caplog.text


@respx.mock
async def test_other_failures_keep_the_provider_message(conn, sleeps):
    # OpenRouter, for one, answers 402 when the account is out of credits.
    route = respx.post(URL).mock(return_value=httpx.Response(402, json={"error": {"message": "Insufficient credits"}}))
    with pytest.raises(RequestFailedError, match="HTTP 402.*Insufficient credits"):
        await call()
    assert route.call_count == 1
    assert sleeps == []


class Answer(BaseModel):
    ok: bool


@respx.mock
async def test_the_extension_headers_pick_the_provider_and_errors_explain_the_setup(monkeypatch, tmp_path):
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
        ok = await client.post("/ask", headers=HEADERS)

    assert missing.status_code == 401
    assert "extension options" in missing.json()["detail"]
    assert ok.status_code == 200
    assert ok.json() == {"ok": True}
    sent = route.calls.last.request
    assert sent.headers["authorization"] == f"Bearer {KEY}"
    assert json.loads(sent.content)["model"] == MODEL


@respx.mock
async def test_llm_check_makes_one_uncached_call_and_names_the_model():
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply('{"ok": true}')))
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
        first = await client.post("/llm/check", headers=HEADERS)
        second = await client.post("/llm/check", headers=HEADERS)
    assert first.json() == second.json() == {"ok": True, "model": MODEL}
    assert route.call_count == 2


@respx.mock
async def test_llm_check_says_when_the_model_ignores_structured_output():
    respx.post(URL).mock(return_value=httpx.Response(200, json=reply("Yes, I am here!")))
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
        response = await client.post("/llm/check", headers=HEADERS)
    assert response.status_code == 502
    assert "structured output" in response.json()["error"]


async def _call_with(base_url):
    token = provider.request_connection.set(Connection(base_url, MODEL, KEY))
    try:
        return await call()
    finally:
        provider.request_connection.reset(token)


@respx.mock
@pytest.mark.parametrize(
    "base_url",
    [
        "http://169.254.169.254/v1",  # cloud metadata
        "https://10.0.0.5/v1",  # inside the network
        "http://llm.example.test/v1",  # the key would cross the internet unencrypted
        "file:///etc/passwd",
    ],
)
async def test_without_an_allowlist_only_internet_https_and_this_computer_are_called(base_url):
    route = respx.route().mock(return_value=httpx.Response(200, json=reply("x")))
    with pytest.raises(ProviderNotAllowedError):
        await _call_with(base_url)
    assert route.call_count == 0


@respx.mock
async def test_a_host_name_that_resolves_inside_the_network_is_refused(conn, monkeypatch):
    route = respx.post(URL).mock(return_value=httpx.Response(200, json=reply("x")))

    async def resolve(host):
        return ["192.168.1.20"]

    monkeypatch.setattr(provider, "_resolve", resolve)
    with pytest.raises(ProviderNotAllowedError):
        await call()
    assert route.call_count == 0


@respx.mock
async def test_ollama_on_this_computer_works_without_an_allowlist():
    respx.post("http://localhost:11434/v1/chat/completions").mock(return_value=httpx.Response(200, json=reply("x")))
    assert await _call_with("http://localhost:11434/v1") == "x"


@respx.mock
async def test_the_allowlist_compares_urls_not_spelling(monkeypatch):
    respx.post("http://10.0.0.5:8080/v1/chat/completions").mock(return_value=httpx.Response(200, json=reply("x")))
    monkeypatch.setattr(settings, "JC_LLM_BASE_URLS", "HTTP://10.0.0.5:8080/v1/")
    assert await _call_with("http://10.0.0.5:8080/v1") == "x"
