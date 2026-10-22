import pytest
from app.schemas.job import Job
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.schemas.search import RerankFacts
from app.services.matching.rerank import rerank_candidates


def make_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Alex Doe",
        email="alex@example.com",
        phone="1234567890",
        location="Bangalore, India",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Software Engineer",
                org="Acme Corp",
                start="2023-01",
                end="2024-01",
                bullets=[Bullet(id="b1", text="Built REST APIs using Python and FastAPI.")],
            )
        ],
        projects=[],
        skills=[
            Skill(name="Python", level="strong"),
            Skill(name="FastAPI", level="strong"),
            Skill(name="SQL", level="working"),
        ],
        certifications=[],
        preferences=Preferences(locations=["Bangalore"], remote="any"),
    )


def make_job(job_id: str, title: str, required_skills: list[str]) -> Job:
    return Job(
        id=job_id,
        source="manual",
        source_id=job_id,
        url=f"https://example.com/{job_id}",
        title=title,
        company="Tech Corp",
        location="Bangalore",
        remote="hybrid",
        job_type="full-time",
        required_skills=required_skills,
        nice_to_have_skills=["Docker", "AWS"],
        experience_years_min=2.0,
        description=f"{title} position requiring {', '.join(required_skills)}.",
        fetched_at="2026-10-18T12:00:00Z",
    )


@pytest.mark.asyncio
async def test_rerank_calls_model_only_for_recalled_candidates(fake_llm):
    call_count = 0

    def mock_rerank_handler(inputs):
        nonlocal call_count
        call_count += 1
        return {
            "matched_required": ["Python"],
            "missing_required": ["Rust"],
            "matched_nice_to_have": ["Docker"],
            "experience_gap": "Requires 2 years; candidate has 1 year",
            "summary": "Solid core Python skills, lacks Rust experience",
        }

    fake_llm.register_handler("rerank.v1.md", mock_rerank_handler)

    profile = make_profile()
    recalled_jobs = [
        make_job("j1", "Backend Dev 1", ["Python", "Rust"]),
        make_job("j2", "Backend Dev 2", ["Python", "SQL"]),
        make_job("j3", "Backend Dev 3", ["Python", "Go"]),
    ]

    results = await rerank_candidates(profile, recalled_jobs)

    # Exactly 3 calls for the 3 recalled candidates
    assert call_count == 3
    assert len(results) == 3

    for res in results:
        facts = res.facts
        assert isinstance(facts, RerankFacts)
        assert isinstance(facts.matched_required, list)
        assert isinstance(facts.missing_required, list)
        assert isinstance(facts.matched_nice_to_have, list)
        assert isinstance(facts.experience_gap, str)
        assert isinstance(facts.summary, str)
        assert len(facts.matched_required) > 0
        assert len(facts.summary) > 0
