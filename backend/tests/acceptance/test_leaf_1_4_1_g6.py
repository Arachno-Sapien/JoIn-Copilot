import logging
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.services.jobs.cache import JobCache


@pytest.mark.asyncio
async def test_email_body_never_appears_in_backend_logs_or_disk(fake_llm, caplog):
    canary_body = "CANARY_EMAIL_BODY_TOKEN_CONFIDENTIAL_123456789"

    fake_llm.register_handler(
        "classify_email.v1.md",
        lambda inputs: {
            "matched_application_id": "app-canary-1",
            "classification": "acknowledgement",
            "confidence": 0.90,
            "reasoning": "Application confirmation receipt.",
        },
    )

    caplog.clear()
    caplog.set_level(logging.DEBUG)

    payload = {
        "email": {
            "sender": "recruiter@canarycorp.com",
            "subject": "Thank you for applying",
            "date": "2026-10-18T18:00:00Z",
            "body": f"Dear Applicant, {canary_body} We received your application.",
        },
        "candidates": [
            {"id": "app-canary-1", "company": "CanaryCorp", "role": "Security Engineer"}
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/email/classify", json=payload)

    assert response.status_code == 200

    # 1. Canary body must never appear in server logs
    assert canary_body not in caplog.text, "Email body leaked into server logs!"

    # 2. Canary body must never be stored in backend SQLite database
    cache = JobCache(db_path=settings.JC_DB_PATH)
    all_jobs = cache.list_jobs(limit=1000)
    for job in all_jobs:
        job_dump = job.model_dump_json()
        assert canary_body not in job_dump, "Email body leaked into SQLite database!"
