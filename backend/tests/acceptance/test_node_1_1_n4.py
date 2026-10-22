import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.services.jobs.cache import JobCache


def make_canary_pdf(canary: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 72), f"Canary Candidate\ncanary@example.com\nSecret canary resume data: {canary}")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.mark.asyncio
async def test_canaries_leave_no_trace_in_cache_or_logs(fake_llm, caplog):
    canary_resume = "CANARY_CONFIDENTIAL_RESUME_CONTENT_778899"
    canary_job_page = "CANARY_CONFIDENTIAL_JOB_PAGE_BODY_998877"

    fake_llm.register_handler(
        "parse_resume.v1.md",
        lambda inputs: {
            "schema_version": 1,
            "name": "Canary Candidate",
            "email": "canary@example.com",
            "phone": "+1234567890",
            "location": "Remote",
            "links": {},
            "education": [],
            "experience": [],
            "projects": [],
            "skills": [{"name": "Python", "level": "strong"}],
            "certifications": [],
            "preferences": {
                "locations": ["Remote"],
                "remote": "remote",
                "job_types": ["full-time"],
            },
        },
    )

    fake_llm.register_handler(
        "extract_job.v1.md",
        lambda inputs: {
            "title": "Data Engineer",
            "company": "Canary Corp",
            "location": "Remote",
            "remote": "remote",
            "job_type": "full-time",
            "required_skills": ["SQL"],
            "nice_to_have_skills": [],
            "experience_years_min": 1,
            "description": "Safe extracted description without canary secret.",
            "posted_at": "2026-10-18",
            "deadline": None,
        },
    )

    caplog.clear()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. POST /profile/parse with canary resume
        pdf_bytes = make_canary_pdf(canary_resume)
        resp1 = await client.post(
            "/profile/parse",
            files={"file": ("canary_resume.pdf", pdf_bytes, "application/pdf")},
        )
        assert resp1.status_code == 200

        # 2. POST /jobs/extract with canary page text
        resp2 = await client.post(
            "/jobs/extract",
            json={"text": f"Pasted job page containing {canary_job_page}", "url": "https://example.com/job/canary"},
        )
        assert resp2.status_code == 200

    # Privacy verification 1: Captured logs contain metadata only, never request bodies
    log_text = caplog.text
    assert canary_resume not in log_text, "Canary resume text leaked into backend logs!"
    assert canary_job_page not in log_text, "Canary job page text leaked into backend logs!"

    # Privacy verification 2: SQLite cache holds only public job data, never personal resume data
    cache = JobCache(db_path=settings.JC_DB_PATH)
    all_cached_jobs = cache.list_jobs(limit=1000)
    for job in all_cached_jobs:
        job_json = job.model_dump_json()
        assert canary_resume not in job_json, "Canary resume personal data leaked into SQLite cache!"
