import sqlite3

from app.schemas.job import Job
from app.services.jobs.cache import JobCache


def _sample_job(job_id: str, title: str = "Backend Engineer") -> Job:
    return Job(
        id=job_id,
        source="greenhouse",
        source_id="101",
        url="https://boards.greenhouse.io/jobs/101",
        title=title,
        company="Acme Corp",
        location="Remote",
        remote="remote",
        job_type="full-time",
        required_skills=["Python", "FastAPI"],
        description="Write code.",
        fetched_at="2026-10-18T12:00:00Z",
    )


def test_sqlite_cache_upsert_and_retrieve(tmp_path):
    db_file = tmp_path / "test_jobs.sqlite"
    cache = JobCache(db_path=str(db_file))
    cache.init_db()

    job1 = _sample_job("id-1", title="Backend Engineer")
    job2 = _sample_job("id-2", title="Frontend Engineer")

    # Upsert jobs
    cache.upsert_jobs([job1, job2])

    retrieved1 = cache.get_job("id-1")
    assert retrieved1 is not None
    assert retrieved1.title == "Backend Engineer"
    assert retrieved1.fetched_at == "2026-10-18T12:00:00Z"
    assert retrieved1.required_skills == ["Python", "FastAPI"]

    # Upsert updated job with same id
    job1_updated = _sample_job("id-1", title="Staff Backend Engineer")
    cache.upsert_jobs([job1_updated])

    retrieved1_updated = cache.get_job("id-1")
    assert retrieved1_updated is not None
    assert retrieved1_updated.title == "Staff Backend Engineer"

    # List jobs
    all_jobs = cache.list_jobs()
    assert len(all_jobs) == 2


def test_sqlite_cache_has_no_personal_data_tables(tmp_path):
    db_file = tmp_path / "test_jobs.sqlite"
    cache = JobCache(db_path=str(db_file))
    cache.init_db()

    # Direct database inspection
    conn = sqlite3.connect(str(db_file))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0].lower() for row in cursor.fetchall()]
    conn.close()

    assert "jobs" in tables

    # Design §2.1 & Product Rule 2: Personal data stays in browser.
    # SQLite file holds public job postings only. Never profiles, resumes, or applications.
    forbidden_tables = [
        "profile",
        "profiles",
        "application",
        "applications",
        "resume",
        "resumes",
        "user",
        "users",
        "email",
        "emails",
        "draft",
        "drafts",
    ]
    for forbidden in forbidden_tables:
        assert forbidden not in tables, f"Found forbidden personal data table '{forbidden}' in backend SQLite database!"
