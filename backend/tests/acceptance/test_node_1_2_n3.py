import json
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

SNAPSHOTS_DIR = Path(__file__).resolve().parent.parent / "snapshots"


@pytest.mark.asyncio
async def test_write_intelligence_snapshots(fake_llm):
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    fake_llm.register_handler(
        "rerank.v1.md",
        lambda inputs: {
            "matched_required": ["Python", "FastAPI"],
            "missing_required": [],
            "matched_nice_to_have": ["Docker"],
            "experience_gap": "",
            "summary": "Strong skill match for backend role.",
        },
    )

    fake_llm.register_handler(
        "draft.v1.md",
        lambda inputs: {
            "draft_text": "I have built REST APIs with FastAPI [exp-1-b1] and managed databases [exp-1-b2].",
        },
    )

    fake_llm.register_handler(
        "extract_claims.v1.md",
        lambda inputs: {
            "claims": [
                {
                    "claim_text": "I have built REST APIs with FastAPI.",
                    "cited_bullet_ids": ["exp-1-b1"],
                },
                {
                    "claim_text": "I managed databases.",
                    "cited_bullet_ids": ["exp-1-b2"],
                },
            ]
        },
    )

    fake_llm.register_handler(
        "judge.v1.md",
        lambda inputs: {
            "verdict": "supported",
            "reason": "Directly supported by resume bullet.",
        },
    )

    fake_llm.register_handler(
        "map_fields.v1.md",
        lambda inputs: {
            "fields": [
                {
                    "field_id": "f_name",
                    "field_name": "Full Name",
                    "action": "fill",
                    "profile_path": "name",
                    "value": "Alex Doe",
                    "is_open_question": False,
                },
                {
                    "field_id": "f_email",
                    "field_name": "Email",
                    "action": "fill",
                    "profile_path": "email",
                    "value": "alex@example.com",
                    "is_open_question": False,
                },
                {
                    "field_id": "f_q",
                    "field_name": "Why this role?",
                    "action": "open_question",
                    "profile_path": None,
                    "value": None,
                    "is_open_question": True,
                },
            ]
        },
    )

    sample_profile = {
        "schema_version": 1,
        "name": "Alex Doe",
        "email": "alex@example.com",
        "phone": "+1234567890",
        "location": "San Francisco, CA",
        "links": {
            "linkedin": "https://linkedin.com/in/alexdoe",
        },
        "education": [],
        "experience": [
            {
                "id": "exp-1",
                "role": "Software Engineer",
                "org": "Tech Co",
                "start": "2022-01",
                "end": "2024-01",
                "bullets": [
                    {"id": "exp-1-b1", "text": "Built REST APIs with FastAPI."},
                    {"id": "exp-1-b2", "text": "Managed databases."},
                ],
            }
        ],
        "projects": [],
        "skills": [{"name": "Python", "level": "strong"}],
        "certifications": [],
        "preferences": {
            "locations": ["San Francisco"],
            "remote": "any",
            "job_types": ["full-time"],
            "min_stipend": None,
            "avoid_keywords": [],
        },
    }

    sample_job = {
        "id": "snap-job-1",
        "source": "manual",
        "source_id": "snap-1",
        "url": "https://example.com/jobs/snap-1",
        "title": "Backend Engineer",
        "company": "Snap Corp",
        "location": "San Francisco, CA",
        "remote": "hybrid",
        "job_type": "full-time",
        "required_skills": ["Python", "FastAPI"],
        "nice_to_have_skills": ["Docker"],
        "experience_years_min": 2,
        "description": "Looking for backend engineer.",
        "posted_at": "2026-10-18T00:00:00Z",
        "deadline": None,
        "fetched_at": "2026-10-18T12:00:00Z",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Snapshot 1: /jobs/search
        search_res = await client.post(
            "/jobs/search",
            json={"profile": sample_profile, "jobs": [sample_job]},
        )
        assert search_res.status_code == 200
        search_file = SNAPSHOTS_DIR / "jobs_search.json"
        search_file.write_text(json.dumps(search_res.json(), indent=2), encoding="utf-8")
        assert search_file.exists()

        # Snapshot 2: /draft
        draft_res = await client.post(
            "/draft",
            json={
                "job": sample_job,
                "question": "Why are you interested in this role?",
                "profile": sample_profile,
            },
        )
        assert draft_res.status_code == 200
        draft_file = SNAPSHOTS_DIR / "draft.json"
        draft_file.write_text(json.dumps(draft_res.json(), indent=2), encoding="utf-8")
        assert draft_file.exists()

        # Snapshot 3: /fill/map-fields
        fill_res = await client.post(
            "/fill/map-fields",
            json={
                "profile": sample_profile,
                "fields": [
                    {"id": "f_name", "label": "Full Name", "type": "text"},
                    {"id": "f_email", "label": "Email", "type": "email"},
                    {"id": "f_q", "label": "Why this role?", "type": "textarea"},
                ],
            },
        )
        assert fill_res.status_code == 200
        fill_file = SNAPSHOTS_DIR / "fill_map_fields.json"
        fill_file.write_text(json.dumps(fill_res.json(), indent=2), encoding="utf-8")
        assert fill_file.exists()
