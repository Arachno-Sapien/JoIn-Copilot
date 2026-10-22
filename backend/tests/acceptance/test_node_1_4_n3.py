import json
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.schemas.job import Job
from app.services.jobs.cache import JobCache

SNAPSHOTS_DIR = Path(__file__).resolve().parent.parent / "snapshots"


@pytest.mark.asyncio
async def test_write_tracking_and_safety_snapshots(fake_llm):
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Register fake LLM handlers
    fake_llm.register_handler(
        "classify_email.v1.md",
        lambda inputs: {
            "classification": "interview",
            "matched_application_id": "app-123",
            "confidence": 0.95,
            "reasoning": "Email invites candidate for a technical round.",
        },
    )

    fake_llm.register_handler(
        "scam_check.v1.md",
        lambda inputs: {
            "risk_level": "low",
            "flags": [],
            "reason": "Standard professional job posting with clear technical interview steps.",
        },
    )

    # 2. Test /email/classify
    email_payload = {
        "email": {
            "sender": "recruiter@acme.com",
            "subject": "Invitation to Technical Interview - Acme Corp",
            "date": "2026-10-18T12:00:00Z",
            "body": "We were impressed with your application and would like to schedule a 45-minute technical interview.",
        },
        "candidates": [
            {"id": "app-123", "company": "Acme Corp", "role": "Software Engineer"}
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        email_resp = await client.post("/email/classify", json=email_payload)
        assert email_resp.status_code == 200, f"Email classify failed: {email_resp.text}"
        email_data = email_resp.json()
        assert email_data["classification"] == "interview"

        # Save snapshot
        email_snapshot_path = SNAPSHOTS_DIR / "email_classify.json"
        with open(email_snapshot_path, "w", encoding="utf-8") as f:
            json.dump(email_data, f, indent=2)

    # 3. Test /jobs/{id}/scam-check
    cache = JobCache(db_path=settings.JC_DB_PATH)
    safe_job = Job(
        id="job-node14-safe",
        source="greenhouse",
        source_id="s-node14",
        title="Full Stack Engineer",
        company="Acme Corp",
        location="Remote",
        remote="remote",
        job_type="full-time",
        required_skills=["TypeScript", "React"],
        nice_to_have_skills=[],
        experience_years_min=3,
        description="Build web applications with clean architecture and participate in code reviews.",
        url="https://acme.com/jobs/1",
        fetched_at="2026-10-18T10:00:00Z",
    )
    cache.upsert_jobs([safe_job])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        scam_resp = await client.post("/jobs/job-node14-safe/scam-check")
        assert scam_resp.status_code == 200, f"Scam check failed: {scam_resp.text}"
        scam_data = scam_resp.json()
        assert scam_data["risk_level"] in ["low", "medium", "high"]

        # Save snapshot
        scam_snapshot_path = SNAPSHOTS_DIR / "scam_check.json"
        with open(scam_snapshot_path, "w", encoding="utf-8") as f:
            json.dump(scam_data, f, indent=2)

    assert email_snapshot_path.exists()
    assert scam_snapshot_path.exists()
