import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.schemas.job import Job
from app.services.jobs.cache import JobCache


@pytest.fixture(autouse=True)
def setup_test_jobs():
    cache = JobCache(db_path=settings.JC_DB_PATH)
    job_low = Job(
        id="job-safe-123",
        source="greenhouse",
        source_id="s-safe",
        title="Software Engineer",
        company="LegitCorp",
        location="New York, NY",
        remote="hybrid",
        job_type="full-time",
        required_skills=["Python"],
        nice_to_have_skills=[],
        experience_years_min=3,
        description="Standard engineering role with structured interview loop.",
        url="https://legitcorp.com/jobs/1",
        fetched_at="2026-10-18T10:00:00Z",
    )
    job_high = Job(
        id="job-scam-999",
        source="manual",
        source_id="s-scam",
        title="Immediate Data Clerk",
        company="",
        location="Remote",
        remote="remote",
        job_type="contract",
        required_skills=[],
        nice_to_have_skills=[],
        experience_years_min=0,
        description="Pay $300 registration fee. Contact WhatsApp +1999999. Immediate start without interview!",
        url="",
        fetched_at="2026-10-18T10:00:00Z",
    )
    cache.upsert_jobs([job_low, job_high])


@pytest.mark.asyncio
async def test_scam_check_endpoint_returns_low_risk(fake_llm):
    fake_llm.register_handler(
        "scam_check.v1.md",
        lambda inputs: {
            "risk_level": "low",
            "flags": [],
            "reasoning": "Standard legitimate job posting.",
        },
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/jobs/job-safe-123/scam-check")

    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "job-safe-123"
    assert data["risk_level"] == "low"
    assert isinstance(data["reasons"], list)


@pytest.mark.asyncio
async def test_scam_check_endpoint_returns_medium_and_high_with_reasons(fake_llm):
    fake_llm.register_handler(
        "scam_check.v1.md",
        lambda inputs: {
            "risk_level": "high",
            "flags": ["Registration fee requested", "WhatsApp only contact"],
            "reasoning": "Clear indicators of advanced fee fraud.",
        },
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/jobs/job-scam-999/scam-check")

    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "job-scam-999"
    assert data["risk_level"] in ["medium", "high"]
    assert len(data["reasons"]) > 0, "Medium and High risk must always return explanatory reasons!"
