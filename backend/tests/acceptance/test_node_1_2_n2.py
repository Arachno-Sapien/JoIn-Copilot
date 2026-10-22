import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.job import Job
from app.schemas.profile import Profile
from app.services.drafting.draft import get_all_profile_bullets
from app.services.jobs.cache import JobCache


def make_synthetic_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(
        (50, 72),
        "Casey Smith\ncasey@example.com\nBangalore, India\n\nExperience:\nBackend Engineer at CloudScale\n- Built high throughput APIs with FastAPI and Python.\n- Maintained PostgreSQL databases and Redis caches.",
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.mark.asyncio
async def test_node_1_2_n2_search_to_draft_pipeline(fake_llm, tmp_path):
    # 1. Setup mock LLM handlers
    fake_llm.register_handler(
        "parse_resume.v1.md",
        lambda inputs: {
            "schema_version": 1,
            "name": "Casey Smith",
            "email": "casey@example.com",
            "phone": "+91-9876543210",
            "location": "Bangalore, India",
            "links": {},
            "education": [],
            "experience": [
                {
                    "id": "exp-1",
                    "role": "Backend Engineer",
                    "org": "CloudScale",
                    "start": "2022-01",
                    "end": "2024-01",
                    "bullets": [
                        {"id": "", "text": "Built high throughput APIs with FastAPI and Python."},
                        {"id": "", "text": "Maintained PostgreSQL databases and Redis caches."},
                    ],
                }
            ],
            "projects": [],
            "skills": [
                {"name": "Python", "level": "strong"},
                {"name": "FastAPI", "level": "strong"},
            ],
            "certifications": [],
            "preferences": {
                "locations": ["Bangalore"],
                "remote": "any",
                "job_types": ["full-time"],
                "min_stipend": None,
                "avoid_keywords": [],
            },
        },
    )

    fake_llm.register_handler(
        "rerank.v1.md",
        lambda inputs: {
            "matched_required": ["Python", "FastAPI"],
            "missing_required": [],
            "matched_nice_to_have": ["PostgreSQL"],
            "experience_gap": "",
            "summary": "Candidate matches all required backend skills.",
        },
    )

    fake_llm.register_handler(
        "draft.v1.md",
        lambda inputs: {
            "draft_text": "I am passionate about backend engineering. At CloudScale, I built high throughput APIs with FastAPI and Python [exp-1-b1].",
        },
    )

    fake_llm.register_handler(
        "extract_claims.v1.md",
        lambda inputs: {
            "claims": [
                {
                    "claim_text": "At CloudScale, I built high throughput APIs with FastAPI and Python.",
                    "cited_bullet_ids": ["exp-1-b1"],
                }
            ]
        },
    )

    fake_llm.register_handler(
        "judge.v1.md",
        lambda inputs: {
            "verdict": "supported",
            "reason": "Directly supported by bullet exp-1-b1.",
        },
    )

    # 2. Seed cached jobs in SQLite
    db_file = str(tmp_path / "n2_jobs.sqlite")
    cache = JobCache(db_path=db_file)
    test_job = Job(
        id="job-n2-1",
        source="manual",
        source_id="n2-1",
        url="https://example.com/jobs/n2-1",
        title="Senior Python Backend Engineer",
        company="Omega Technologies",
        location="Bangalore, India",
        remote="hybrid",
        job_type="full-time",
        required_skills=["Python", "FastAPI"],
        description="We are seeking an experienced Python FastAPI developer.",
        fetched_at="2026-10-18T12:00:00Z",
    )
    cache.upsert_jobs([test_job])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step A: Parse synthetic resume
        pdf_bytes = make_synthetic_pdf()
        parse_resp = await client.post(
            "/profile/parse",
            files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
        )
        assert parse_resp.status_code == 200, f"Parse failed: {parse_resp.text}"
        profile_data = parse_resp.json()
        parsed_profile = Profile.model_validate(profile_data)
        all_profile_bullet_ids = {b.id for b in get_all_profile_bullets(parsed_profile)}
        assert len(all_profile_bullet_ids) > 0
        assert "exp-1-b1" in all_profile_bullet_ids

        # Step B: Search jobs with parsed profile
        search_resp = await client.post(
            "/jobs/search",
            json={"profile": profile_data, "jobs": [test_job.model_dump()]},
        )
        assert search_resp.status_code == 200, f"Search failed: {search_resp.text}"
        search_data = search_resp.json()
        assert len(search_data["results"]) > 0
        top_ranked = search_data["results"][0]
        assert top_ranked["fit_score"] > 80.0
        top_job = top_ranked["job"]

        # Step C: Draft answer for top job
        draft_resp = await client.post(
            "/draft",
            json={
                "job": top_job,
                "question": "Why are you interested in this backend role?",
                "profile": profile_data,
            },
        )
        assert draft_resp.status_code == 200, f"Draft failed: {draft_resp.text}"
        draft_data = draft_resp.json()

        # Step D: Verify every cited bullet ID exists in the parsed profile
        cited_ids_found = []
        for claim in draft_data["claims"]:
            cited_ids_found.extend(claim["cited_ids"])

        assert len(cited_ids_found) > 0, "Expected at least one cited bullet ID"
        for cid in cited_ids_found:
            assert cid in all_profile_bullet_ids, f"Cited bullet {cid} not found in parsed profile"
