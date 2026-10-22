from app.schemas.job import Job
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.services.drafting.draft import (
    build_draft_prompt_inputs,
    check_cited_ids,
    get_all_profile_bullets,
)


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Jordan Lee",
        email="jordan@example.com",
        phone="555-4321",
        location="Chicago, IL",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Engineer",
                org="Beta Corp",
                start="2021-01",
                end="2023-01",
                bullets=[Bullet(id="exp-1-b1", text="Built automated data pipelines.")],
            )
        ],
        projects=[],
        skills=[Skill(name="Python", level="working")],
        certifications=[],
        preferences=Preferences(),
    )


def sample_job() -> Job:
    return Job(
        id="job-1",
        source="manual",
        source_id="1",
        url="https://example.com/1",
        title="Data Engineer",
        company="Data Corp",
        location="Chicago, IL",
        remote="onsite",
        job_type="full-time",
        required_skills=["Python"],
        description="Looking for data engineer.",
        fetched_at="2026-10-18T12:00:00Z",
    )


def test_get_all_profile_bullets_empty_and_populated():
    prof = sample_profile()
    bullets = get_all_profile_bullets(prof)
    assert len(bullets) == 1
    assert bullets[0].id == "exp-1-b1"

    prof.experience = []
    assert get_all_profile_bullets(prof) == []


def test_check_cited_ids_empty_citations():
    prof = sample_profile()
    valid, invalid = check_cited_ids([], prof)
    assert valid == []
    assert invalid == []


def test_build_draft_prompt_inputs_handles_missing_fields():
    prof = sample_profile()
    prof.skills = []
    prof.experience = []
    job = sample_job()
    inputs = build_draft_prompt_inputs(job, "Question?", prof)
    assert inputs["profile_bullets"] == "None provided."
    assert inputs["profile_skills"] == "None specified."
