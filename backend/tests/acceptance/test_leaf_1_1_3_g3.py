import hashlib
from app.schemas.job import Job
from app.services.jobs.dedup import deduplicate_jobs, normalize_company_name


def _make_job(
    source: str,
    source_id: str,
    company: str,
    title: str,
    location: str = "Bangalore, India",
    description: str = "Job description",
) -> Job:
    return Job(
        id=hashlib.sha1(f"{source}{source_id}".encode("utf-8")).hexdigest(),
        source=source,  # type: ignore[arg-type]
        source_id=source_id,
        url=f"https://example.com/{source}/{source_id}",
        title=title,
        company=company,
        location=location,
        description=description,
        fetched_at="2026-10-18T10:00:00Z",
    )


def test_normalize_company_name():
    assert normalize_company_name("Acme Pvt Ltd") == "acme"
    assert normalize_company_name("Acme Pvt. Ltd.") == "acme"
    assert normalize_company_name("Acme, Inc.") == "acme"
    assert normalize_company_name("Acme Inc") == "acme"
    assert normalize_company_name("Acme LLC") == "acme"
    assert normalize_company_name("Acme Limited") == "acme"
    assert normalize_company_name("Acme Corp.") == "acme"
    assert normalize_company_name("Acme Corporation") == "acme"
    assert normalize_company_name("  Acme  Co.  ") == "acme"


def test_deduplication_merges_same_posting_across_sources():
    job_adzuna = _make_job(
        source="adzuna",
        source_id="adz-1",
        company="Acme Pvt Ltd",
        title="Senior Backend Engineer (Python)",
        location="Bangalore",
        description="Looking for Python backend engineer.",
    )
    job_greenhouse = _make_job(
        source="greenhouse",
        source_id="gh-2",
        company="Acme Inc.",
        title="Senior Backend Engineer - Python",
        location="Bangalore",
        description="Join Acme Inc to build backend services in Python.",
    )

    deduped = deduplicate_jobs([job_adzuna, job_greenhouse])
    assert len(deduped) == 1
    # Merged job retains valid structure
    assert deduped[0].location == "Bangalore"


def test_deduplication_keeps_distinct_postings_apart():
    job1 = _make_job(
        source="adzuna",
        source_id="adz-1",
        company="Acme Pvt Ltd",
        title="Senior Backend Engineer",
        location="Bangalore",
    )
    job2 = _make_job(
        source="greenhouse",
        source_id="gh-2",
        company="Acme Inc.",
        title="Senior Backend Engineer",
        location="Bangalore",
    )
    # Different role at same company
    job3 = _make_job(
        source="lever",
        source_id="lev-3",
        company="Acme Corp",
        title="Product Manager",
        location="Bangalore",
    )
    # Same role at different company
    job4 = _make_job(
        source="adzuna",
        source_id="adz-4",
        company="Globex Corporation",
        title="Senior Backend Engineer",
        location="Bangalore",
    )

    deduped = deduplicate_jobs([job1, job2, job3, job4])
    assert len(deduped) == 3
    companies = {j.company for j in deduped}
    titles = {j.title for j in deduped}
    assert "Product Manager" in titles
    assert any("Globex" in c for c in companies)
