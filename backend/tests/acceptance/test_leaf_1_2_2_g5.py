import pytest
from httpx import ASGITransport, AsyncClient

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
async def test_draft_endpoint_returns_complete_fabrication_report(fake_llm):
    # Step 1: Draft response
    fake_llm.register_handler(
        "draft.v1.md",
        lambda inputs: {
            "draft_text": "I have experience with FastAPI [exp-1-b1]. I also invented quantum computing.",
        },
    )

    # Step 2: Extract claims
    fake_llm.register_handler(
        "extract_claims.v1.md",
        lambda inputs: {
            "claims": [
                {
                    "claim_text": "I have experience with FastAPI.",
                    "cited_bullet_ids": ["exp-1-b1"],
                },
                {
                    "claim_text": "I also invented quantum computing.",
                    "cited_bullet_ids": [],
                },
            ]
        },
    )

    # Step 3: Judge
    def judge_handler(inputs):
        claim = inputs.get("claim_text", "")
        if "FastAPI" in claim:
            return {"verdict": "supported", "reason": "Matches bullet exp-1-b1."}
        else:
            return {"verdict": "unsupported", "reason": "No evidence in profile."}

    fake_llm.register_handler("judge.v1.md", judge_handler)

    # Step 4: Rewrite
    fake_llm.register_handler(
        "rewrite.v1.md",
        lambda inputs: {
            "rewritten_text": "I have extensive experience with FastAPI.",
        },
    )

    profile = sample_profile()
    job = sample_job()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/draft",
            json={
                "job": job.model_dump(),
                "question": "Why are you suitable for this role?",
                "profile": profile.model_dump(),
            },
        )

        assert response.status_code == 200, f"Error: {response.text}"
        data = response.json()

        assert "draft" in data
        assert "FastAPI" in data["draft"]

        assert "claims" in data
        assert len(data["claims"]) == 2
        assert data["claims"][0]["verdict"] == "supported"
        assert data["claims"][1]["verdict"] == "unsupported"
        assert data["claims"][1]["is_flagged"] is True

        assert "flagged_spans" in data
        assert len(data["flagged_spans"]) > 0

        assert "rewrite" in data
        assert "quantum" not in data["rewrite"]
