import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
REJECTED_ORIGINS = [
    "https://evil.com",
    "http://localhost:3000",
    "chrome-extension://short",
    "chrome-extension://qrstuvwxyzqrstuvwxyzqrstuvwxyzqr",  # letters outside a-p
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop.evil.com",
]


def preflight(origin):
    return {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }


async def test_extension_origin_passes_preflight_and_simple_requests():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        pre = await client.options("/health", headers=preflight(EXTENSION_ORIGIN))
        simple = await client.get("/health", headers={"Origin": EXTENSION_ORIGIN})
    assert pre.status_code == 200
    assert pre.headers.get("access-control-allow-origin") == EXTENSION_ORIGIN
    assert simple.headers.get("access-control-allow-origin") == EXTENSION_ORIGIN


@pytest.mark.parametrize("origin", REJECTED_ORIGINS)
async def test_other_origins_get_no_allow_origin_header_at_all(origin):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        pre = await client.options("/health", headers=preflight(origin))
        simple = await client.get("/health", headers={"Origin": origin})
    # Absent, not merely different: a wildcard "*" would also fail this.
    assert pre.headers.get("access-control-allow-origin") is None
    assert simple.headers.get("access-control-allow-origin") is None
