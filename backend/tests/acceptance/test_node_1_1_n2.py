import json
from pathlib import Path
import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

SNAPSHOTS_DIR = Path(__file__).resolve().parent.parent / "snapshots"


def make_snapshot_resume_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 72), "Alex Doe\nalex@example.com\nSan Francisco, CA\nSoftware Engineer")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.mark.asyncio
async def test_write_foundation_snapshots(fake_llm):
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    fake_llm.register_handler(
        "parse_resume.v1.md",
        lambda inputs: {
            "schema_version": 1,
            "name": "Alex Doe",
            "email": "alex@example.com",
            "phone": "+1234567890",
            "location": "San Francisco, CA",
            "links": {
                "linkedin": "https://linkedin.com/in/alexdoe",
                "github": "https://github.com/alexdoe",
            },
            "education": [
                {
                    "id": "edu-1",
                    "degree": "B.S. CS",
                    "institution": "University",
                    "start": "2018",
                    "end": "2022",
                }
            ],
            "experience": [
                {
                    "id": "exp-1",
                    "role": "Software Engineer",
                    "org": "Acme Corp",
                    "start": "2022",
                    "end": "present",
                    "bullets": [
                        {"id": "", "text": "Built distributed services with FastAPI."},
                    ],
                }
            ],
            "projects": [
                {
                    "id": "proj-1",
                    "name": "Job Copilot",
                    "bullets": [
                        {"id": "", "text": "Created Chrome extension."},
                    ],
                }
            ],
            "skills": [
                {"name": "Python", "level": "strong"},
                {"name": "TypeScript", "level": "familiar"},
            ],
            "certifications": [],
            "preferences": {
                "locations": ["San Francisco"],
                "remote": "hybrid",
                "job_types": ["full-time"],
            },
        },
    )

    fake_llm.register_handler(
        "extract_job.v1.md",
        lambda inputs: {
            "title": "Backend Software Engineer",
            "company": "Tech Corp",
            "location": "Remote",
            "remote": "remote",
            "job_type": "full-time",
            "required_skills": ["Python", "FastAPI"],
            "nice_to_have_skills": ["Docker"],
            "experience_years_min": 2,
            "description": "Looking for backend engineer to scale services.",
            "posted_at": "2026-10-18T00:00:00Z",
            "deadline": None,
        },
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. /health snapshot
        health_resp = await client.get("/health")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        (SNAPSHOTS_DIR / "health.json").write_text(json.dumps(health_data, indent=2), encoding="utf-8")

        # 2. /jobs/extract snapshot
        extract_resp = await client.post(
            "/jobs/extract",
            json={"text": "Tech Corp is hiring Backend Software Engineer in Remote...", "url": "https://example.com/jobs/42"},
        )
        assert extract_resp.status_code == 200
        extract_data = extract_resp.json()
        (SNAPSHOTS_DIR / "jobs_extract.json").write_text(json.dumps(extract_data, indent=2), encoding="utf-8")

        # 3. /profile/parse snapshot
        pdf_bytes = make_snapshot_resume_pdf()
        profile_resp = await client.post(
            "/profile/parse",
            files={"file": ("alex_doe_resume.pdf", pdf_bytes, "application/pdf")},
        )
        assert profile_resp.status_code == 200
        profile_data = profile_resp.json()
        (SNAPSHOTS_DIR / "profile_parse.json").write_text(json.dumps(profile_data, indent=2), encoding="utf-8")

    assert (SNAPSHOTS_DIR / "health.json").exists()
    assert (SNAPSHOTS_DIR / "jobs_extract.json").exists()
    assert (SNAPSHOTS_DIR / "profile_parse.json").exists()
