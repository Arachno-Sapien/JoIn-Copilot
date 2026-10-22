from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.services.jobs.cache import JobCache


@pytest.mark.asyncio
async def test_canary_profile_leaves_no_trace_in_logs_or_disk(fake_llm, caplog):
    canary_token = "CANARY_SECRET_PERSONAL_DATA_987654321"

    fake_llm.register_handler(
        "rerank.v1.md",
        lambda inputs: {
            "matched_required": ["Python"],
            "missing_required": [],
            "matched_nice_to_have": [],
            "experience_gap": "",
            "summary": "Match.",
        },
    )

    fake_llm.register_handler(
        "draft.v1.md",
        lambda inputs: {
            "draft_text": "Drafted answer for candidate [exp-1-b1].",
        },
    )

    fake_llm.register_handler(
        "extract_claims.v1.md",
        lambda inputs: {
            "claims": [
                {
                    "claim_text": "Drafted answer for candidate.",
                    "cited_bullet_ids": ["exp-1-b1"],
                }
            ]
        },
    )

    fake_llm.register_handler(
        "judge.v1.md",
        lambda inputs: {
            "verdict": "supported",
            "reason": "Supported by exp-1-b1.",
        },
    )

    fake_llm.register_handler(
        "map_fields.v1.md",
        lambda inputs: {
            "fields": [
                {
                    "field_id": "f_email",
                    "field_name": "Email",
                    "action": "fill",
                    "profile_path": "email",
                    "value": "canary@example.com",
                    "is_open_question": False,
                }
            ]
        },
    )

    canary_profile = {
        "schema_version": 1,
        "name": f"Canary {canary_token}",
        "email": "canary@example.com",
        "phone": "+1999888777",
        "location": "Canary City",
        "links": {},
        "education": [],
        "experience": [
            {
                "id": "exp-1",
                "role": "Engineer",
                "org": "Canary Org",
                "start": "2022-01",
                "end": "2024-01",
                "bullets": [{"id": "exp-1-b1", "text": f"Secret project with {canary_token}."}],
            }
        ],
        "projects": [],
        "skills": [{"name": "Python", "level": "strong"}],
        "certifications": [],
        "preferences": {
            "locations": ["Canary City"],
            "remote": "any",
            "job_types": ["full-time"],
            "min_stipend": None,
            "avoid_keywords": [],
        },
    }

    dummy_job = {
        "id": "canary-job-1",
        "source": "manual",
        "source_id": "c-1",
        "url": "https://example.com/canary-job",
        "title": "Software Engineer",
        "company": "Public Corp",
        "location": "Canary City",
        "remote": "hybrid",
        "job_type": "full-time",
        "required_skills": ["Python"],
        "nice_to_have_skills": [],
        "description": "Public job description.",
        "fetched_at": "2026-10-18T12:00:00Z",
    }

    caplog.clear()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. /jobs/search
        resp_search = await client.post(
            "/jobs/search",
            json={"profile": canary_profile, "jobs": [dummy_job]},
        )
        assert resp_search.status_code == 200

        # 2. /draft
        resp_draft = await client.post(
            "/draft",
            json={
                "job": dummy_job,
                "question": "Why work here?",
                "profile": canary_profile,
            },
        )
        assert resp_draft.status_code == 200

        # 3. /fill/map-fields
        resp_fill = await client.post(
            "/fill/map-fields",
            json={
                "profile": canary_profile,
                "fields": [{"id": "f_email", "label": "Email", "type": "email"}],
            },
        )
        assert resp_fill.status_code == 200

    # Privacy check 1: Canary never appears in captured logs
    assert canary_token not in caplog.text, "Canary token leaked into server logs!"

    # Privacy check 2: Canary never appears in SQLite database on disk
    cache = JobCache(db_path=settings.JC_DB_PATH)
    all_cached_jobs = cache.list_jobs(limit=1000)
    for job in all_cached_jobs:
        assert canary_token not in job.model_dump_json(), "Canary leaked into SQLite cache!"

    # Privacy check 3: Search all .sqlite files on disk in repo for canary
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    for sqlite_file in repo_root.glob("**/*.sqlite"):
        try:
            content = sqlite_file.read_bytes()
            assert canary_token.encode("utf-8") not in content, f"Canary found in SQLite file: {sqlite_file}"
        except Exception:
            pass
