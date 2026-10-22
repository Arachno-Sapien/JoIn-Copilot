import pytest
from app.schemas.job import Job
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.services.matching.filters import hard_filter_jobs


def make_profile(
    locations: list[str] | None = None,
    remote: str = "any",
    job_types: list[str] | None = None,
    avoid_keywords: list[str] | None = None,
    experience_years: float = 2.0,
) -> Profile:
    # 2 years of experience by default
    return Profile(
        schema_version=1,
        name="Test User",
        email="user@example.com",
        phone="1234567890",
        location=locations[0] if locations else "Bangalore, India",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Software Engineer",
                org="Tech Co",
                start="2022-01",
                end="2024-01",
                bullets=[Bullet(id="b1", text="Built APIs with Python and FastAPI")],
            )
        ],
        projects=[],
        skills=[Skill(name="Python", level="strong"), Skill(name="FastAPI", level="strong")],
        certifications=[],
        preferences=Preferences(
            locations=locations or [],
            remote=remote,  # "any", "remote", "onsite", "hybrid"
            job_types=job_types or [],
            avoid_keywords=avoid_keywords or [],
        ),
    )


def make_job(
    id: str,
    title: str = "Python Developer",
    company: str = "Acme Corp",
    location: str = "Bangalore, India",
    remote: str = "hybrid",
    job_type: str = "full-time",
    experience_years_min: float | None = 1.0,
    description: str = "Python FastAPI developer needed",
) -> Job:
    return Job(
        id=id,
        source="manual",
        source_id=id,
        url=f"https://example.com/jobs/{id}",
        title=title,
        company=company,
        location=location,
        remote=remote,
        job_type=job_type,
        experience_years_min=experience_years_min,
        description=description,
        fetched_at="2026-10-18T12:00:00Z",
    )


def test_hard_filter_location():
    profile = make_profile(locations=["Bangalore", "Hyderabad"], remote="onsite")
    job_pass = make_job("j1", location="Bangalore, India", remote="onsite")
    job_fail = make_job("j2", location="Berlin, Germany", remote="onsite")
    job_remote_pass = make_job("j3", location="London, UK", remote="remote")

    filtered = hard_filter_jobs([job_pass, job_fail, job_remote_pass], profile)
    filtered_ids = [j.id for j in filtered]
    assert "j1" in filtered_ids
    assert "j2" not in filtered_ids
    # Fully remote jobs should pass even if location differs
    assert "j3" in filtered_ids


def test_hard_filter_remote_preference():
    profile_remote_only = make_profile(remote="remote")
    job_remote = make_job("j1", remote="remote")
    job_onsite = make_job("j2", remote="onsite")
    job_hybrid = make_job("j3", remote="hybrid")

    filtered = hard_filter_jobs([job_remote, job_onsite, job_hybrid], profile_remote_only)
    filtered_ids = [j.id for j in filtered]
    assert "j1" in filtered_ids
    assert "j2" not in filtered_ids
    assert "j3" not in filtered_ids


def test_hard_filter_job_type():
    profile_internship = make_profile(job_types=["internship"])
    job_internship = make_job("j1", job_type="internship")
    job_fulltime = make_job("j2", job_type="full-time")

    filtered = hard_filter_jobs([job_internship, job_fulltime], profile_internship)
    filtered_ids = [j.id for j in filtered]
    assert "j1" in filtered_ids
    assert "j2" not in filtered_ids


def test_hard_filter_experience_years_min():
    # Profile has ~2 years of experience from exp-1 (2022-01 to 2024-01)
    profile = make_profile()
    job_ok = make_job("j1", experience_years_min=1.5)
    job_too_high = make_job("j2", experience_years_min=5.0)

    filtered = hard_filter_jobs([job_ok, job_too_high], profile)
    filtered_ids = [j.id for j in filtered]
    assert "j1" in filtered_ids
    assert "j2" not in filtered_ids


def test_hard_filter_avoid_keywords():
    profile = make_profile(avoid_keywords=["crypto", "unpaid", "gambling"])
    job_clean = make_job("j1", title="Backend Engineer", description="Build payment processing services")
    job_crypto_title = make_job("j2", title="Crypto Lead Engineer", description="Web3 platform")
    job_unpaid_desc = make_job("j3", title="Software Intern", description="This is an unpaid internship position")
    job_gambling_company = make_job("j4", company="Gambling Games Ltd", title="Full Stack Developer")

    filtered = hard_filter_jobs([job_clean, job_crypto_title, job_unpaid_desc, job_gambling_company], profile)
    filtered_ids = [j.id for j in filtered]
    assert "j1" in filtered_ids
    assert "j2" not in filtered_ids
    assert "j3" not in filtered_ids
    assert "j4" not in filtered_ids
