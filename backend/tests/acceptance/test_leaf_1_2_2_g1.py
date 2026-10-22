from app.schemas.job import Job
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.services.drafting.draft import build_draft_prompt_inputs, check_cited_ids


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Taylor Dev",
        email="taylor@example.com",
        phone="555-0199",
        location="Austin, TX",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Backend Engineer",
                org="Acme",
                start="2022-01",
                end="2024-01",
                bullets=[
                    Bullet(id="exp-1-b1", text="Built REST APIs using FastAPI and Python."),
                    Bullet(id="exp-1-b2", text="Optimized database queries in PostgreSQL."),
                ],
            )
        ],
        projects=[],
        skills=[
            Skill(name="Python", level="strong"),
            Skill(name="Docker", level="familiar"),
        ],
        certifications=[],
        preferences=Preferences(locations=["Austin"], remote="any"),
    )


def sample_job() -> Job:
    return Job(
        id="job-1",
        source="manual",
        source_id="1",
        url="https://example.com/jobs/1",
        title="Senior Python Engineer",
        company="Tech Corp",
        location="Austin, TX",
        remote="hybrid",
        job_type="full-time",
        required_skills=["Python", "FastAPI"],
        description="Looking for senior engineer.",
        fetched_at="2026-10-18T12:00:00Z",
    )


def test_draft_prompt_includes_all_bullet_ids_and_skill_levels():
    profile = sample_profile()
    job = sample_job()
    inputs = build_draft_prompt_inputs(job, "Why should we hire you?", profile)

    # Verify bullet IDs are in the prompt inputs
    profile_bullets = inputs["profile_bullets"]
    assert "exp-1-b1" in profile_bullets
    assert "exp-1-b2" in profile_bullets
    assert "Built REST APIs using FastAPI and Python" in profile_bullets

    # Verify skills and stated levels are in the prompt inputs
    profile_skills = inputs["profile_skills"]
    assert "Python (strong)" in profile_skills
    assert "Docker (familiar)" in profile_skills


def test_draft_citing_absent_id_is_flagged():
    profile = sample_profile()
    # Citations that include a valid id and an absent phantom id
    citations = ["exp-1-b1", "phantom-id-99"]
    valid_ids, invalid_ids = check_cited_ids(citations, profile)

    assert "exp-1-b1" in valid_ids
    assert "phantom-id-99" in invalid_ids
