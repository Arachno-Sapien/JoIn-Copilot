import pytest
from httpx import ASGITransport, AsyncClient

from app.llm.cache import clear_llm_cache
from app.main import app
from app.schemas.job import Job
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Sam Taylor",
        email="sam@example.com",
        phone="555-1234",
        location="Boston, MA",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Software Engineer",
                org="Alpha Labs",
                start="2022-01",
                end="2024-01",
                bullets=[Bullet(id="exp-1-b1", text="Built backend microservices using FastAPI.")],
            )
        ],
        projects=[],
        skills=[Skill(name="Python", level="strong")],
        certifications=[],
        preferences=Preferences(),
    )


def sample_job() -> Job:
    return Job(
        id="job-1",
        source="manual",
        source_id="1",
        url="https://example.com/jobs/1",
        title="Backend Developer",
        company="Omega Co",
        location="Boston, MA",
        remote="onsite",
        job_type="full-time",
        required_skills=["Python", "FastAPI"],
        description="Looking for Python backend developer.",
        fetched_at="2026-10-18T12:00:00Z",
    )


@pytest.mark.asyncio
async def test_repeated_identical_draft_request_hits_in_memory_cache(fake_llm):
    clear_llm_cache()

    model_calls = 0

    def draft_handler(inputs):
        nonlocal model_calls
        model_calls += 1
        return {"draft_text": "I built backend services using FastAPI [exp-1-b1]."}

    def extract_handler(inputs):
        nonlocal model_calls
        model_calls += 1
        return {
            "claims": [
                {
                    "claim_text": "I built backend services using FastAPI.",
                    "cited_bullet_ids": ["exp-1-b1"],
                }
            ]
        }

    def judge_handler(inputs):
        nonlocal model_calls
        model_calls += 1
        return {"verdict": "supported", "reason": "Supported by exp-1-b1."}

    fake_llm.register_handler("draft.v1.md", draft_handler)
    fake_llm.register_handler("extract_claims.v1.md", extract_handler)
    fake_llm.register_handler("judge.v1.md", judge_handler)

    profile = sample_profile()
    job = sample_job()
    payload = {
        "job": job.model_dump(),
        "question": "Tell us about your background.",
        "profile": profile.model_dump(),
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # First request
        resp1 = await client.post("/draft", json=payload)
        assert resp1.status_code == 200
        first_calls = model_calls
        assert first_calls > 0

        # Second identical request
        resp2 = await client.post("/draft", json=payload)
        assert resp2.status_code == 200

        # No additional model calls made
        assert model_calls == first_calls
        assert resp1.json() == resp2.json()
