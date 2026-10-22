import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.job import Job
from app.schemas.profile import Bullet, Experience, Preferences, Profile


@pytest.mark.asyncio
async def test_draft_containing_unauthorized_email_or_url_is_flagged(fake_llm):
    profile = Profile(
        schema_version=1,
        name="Alex Candidate",
        email="alex@legit.com",
        phone="+1-555-0100",
        location="Remote",
        links={"github": "https://github.com/alex"},
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Software Engineer",
                org="TechCorp",
                start="2022-01",
                end="2024-01",
                bullets=[Bullet(id="b1", text="Built APIs in Python.")],
            )
        ],
        projects=[],
        skills=[],
        certifications=[],
        preferences=Preferences(),
    )

    job = Job(
        id="job-draft-test",
        source="greenhouse",
        source_id="s1",
        title="Python Engineer",
        company="GreatCo",
        location="Remote",
        remote="remote",
        job_type="full-time",
        required_skills=["Python"],
        nice_to_have_skills=[],
        experience_years_min=2,
        description="Write Python services.",
        url="https://greatco.com/jobs/1",
        fetched_at="2026-10-18T10:00:00Z",
    )

    # 1. Mock draft generation to return unauthorized contact info in draft_text
    fake_llm.register_handler(
        "draft.v1.md",
        lambda inputs: {
            "draft_text": "I am interested in this role. You can reach my agent at phisher@malicious.com or see my private site http://unauthorized-leak.com for details.",
        },
    )

    # 2. Mock claim extraction
    fake_llm.register_handler(
        "extract_claims.v1.md",
        lambda inputs: {"claims": [{"claim_text": "Interested in role.", "cited_bullet_ids": ["b1"]}]},
    )

    # 3. Mock claim judge
    fake_llm.register_handler(
        "judge.v1.md",
        lambda inputs: {"verdict": "supported", "reason": "Supported by experience."},
    )

    payload = {
        "job": job.model_dump(),
        "profile": profile.model_dump(),
        "question": "Why are you interested in this position?",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/draft", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "flagged_spans" in data, "Draft response must include flagged_spans for safety checks!"
    spans = data["flagged_spans"]
    assert any("phisher@malicious.com" in s["text"] or "unauthorized-leak.com" in s["text"] for s in spans), (
        f"Unauthorized email or URL must be flagged: {spans}"
    )
