import logging
import re

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.main import create_app

CANARY = "CANARY_SECRET_USER_PAYLOAD_987654321"
LOG_LINE = re.compile(r"^method=(\w+) path=(\S+) status=(\d{3}) latency_ms=\d+\.\d{2}$")
CLIENT_LOGGERS = ("httpx", "httpcore")  # the test client logs its own URLs; only server logs count


class Payload(BaseModel):
    note: str


@pytest.fixture
def client():
    app = create_app()

    @app.post("/echo")
    async def echo(payload: Payload):
        return {"length": len(payload.note)}

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def server_log(caplog):
    return "\n".join(
        r.getMessage() + (r.exc_text or "") for r in caplog.records if not r.name.startswith(CLIENT_LOGGERS)
    )


def request_lines(caplog):
    return [LOG_LINE.match(r.getMessage()).groups() for r in caplog.records if r.name == "app.request"]


async def test_a_read_request_body_never_reaches_the_logs(client, caplog):
    caplog.set_level(logging.DEBUG)
    async with client:
        response = await client.post("/echo", json={"note": CANARY})
    assert response.status_code == 200
    assert CANARY not in server_log(caplog)
    assert request_lines(caplog) == [("POST", "/echo", "200")]


async def test_query_strings_and_rejected_bodies_never_reach_the_logs(client, caplog):
    caplog.set_level(logging.DEBUG)
    async with client:
        await client.get(f"/health?email={CANARY}")
        rejected = await client.post("/echo", json={"wrong_field": CANARY})
    assert rejected.status_code == 422
    assert CANARY not in server_log(caplog)
    assert request_lines(caplog) == [("GET", "/health", "200"), ("POST", "/echo", "422")]
