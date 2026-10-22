import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.main import create_app
from app.schemas.common import ErrorResponse

CANARY = "CANARY_PRIVATE_VALUE_4242"


class Payload(BaseModel):
    count: int


@pytest.fixture
def client():
    app = create_app()

    @app.post("/typed")
    async def typed(payload: Payload):
        return {"count": payload.count}

    @app.get("/refuse")
    async def refuse():
        raise HTTPException(status_code=422, detail="Upload a text-based resume")

    @app.get("/crash")
    async def crash():
        raise RuntimeError(f"internal detail {CANARY}")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    return AsyncClient(transport=transport, base_url="http://test")


def error_body(response):
    body = response.json()
    assert set(body) <= {"error", "detail"}, body
    return ErrorResponse.model_validate(body)


async def test_unknown_route_returns_an_error_body(client):
    async with client:
        response = await client.get("/no-such-route")
    assert response.status_code == 404
    assert error_body(response).error


async def test_http_exception_keeps_its_detail_in_an_error_body(client):
    async with client:
        response = await client.get("/refuse")
    assert response.status_code == 422
    body = error_body(response)
    assert body.error
    assert body.detail == "Upload a text-based resume"


async def test_validation_failure_names_the_field_without_echoing_the_value(client):
    async with client:
        response = await client.post("/typed", json={"count": CANARY})
    assert response.status_code == 422
    body = error_body(response)
    assert "count" in (body.detail or "")
    assert CANARY not in response.text


async def test_unhandled_error_returns_a_generic_500_without_internal_details(client):
    async with client:
        response = await client.get("/crash")
    assert response.status_code == 500
    assert error_body(response).error
    assert CANARY not in response.text
