from datetime import UTC, datetime, timedelta

import httpx
import pytest
import respx

from app.config import settings
from app.schemas.job import Job
from app.services.jobs.cache import JobCache
from app.services.jobs.refresh import refresh_jobs


@pytest.mark.asyncio
@respx.mock
async def test_refresh_jobs_resilient_to_board_failure(monkeypatch, tmp_path):
    db_file = tmp_path / "test_jobs.sqlite"
    monkeypatch.setattr(settings, "JC_DB_PATH", str(db_file))
    monkeypatch.setattr(settings, "JC_GREENHOUSE_BOARDS", "goodboard,badboard")
    monkeypatch.setattr(settings, "JC_LEVER_COMPANIES", "")
    monkeypatch.setattr(settings, "JC_ADZUNA_QUERIES", "")

    respx.get("https://boards-api.greenhouse.io/v1/boards/goodboard/jobs?content=true").mock(
        return_value=httpx.Response(
            200,
            json={
                "jobs": [
                    {
                        "id": 101,
                        "title": "Backend Dev",
                        "location": {"name": "Remote"},
                        "content": "<p>Build APIs</p>",
                        "absolute_url": "https://example.com/jobs/101",
                    }
                ]
            },
        )
    )
    respx.get("https://boards-api.greenhouse.io/v1/boards/badboard/jobs?content=true").mock(
        return_value=httpx.Response(500)
    )

    cache = JobCache(str(db_file))
    count = await refresh_jobs(cache=cache)
    assert count == 1
    jobs = cache.list_jobs()
    assert len(jobs) == 1
    assert jobs[0].title == "Backend Dev"


@pytest.mark.asyncio
@respx.mock
async def test_same_posting_deduplicates(monkeypatch, tmp_path):
    db_file = tmp_path / "test_jobs.sqlite"
    monkeypatch.setattr(settings, "JC_DB_PATH", str(db_file))
    monkeypatch.setattr(settings, "JC_GREENHOUSE_BOARDS", "stripe")
    monkeypatch.setattr(settings, "JC_LEVER_COMPANIES", "")
    monkeypatch.setattr(settings, "JC_ADZUNA_QUERIES", "software engineer")
    monkeypatch.setattr(settings, "ADZUNA_APP_ID", "dummy_id")
    monkeypatch.setattr(settings, "ADZUNA_APP_KEY", "dummy_key")

    respx.get("https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true").mock(
        return_value=httpx.Response(
            200,
            json={
                "jobs": [
                    {
                        "id": 500,
                        "title": "Staff Engineer",
                        "location": {"name": "San Francisco"},
                        "content": "<p>Lead arch</p>",
                        "absolute_url": "https://stripe.com/jobs/500",
                    }
                ]
            },
        )
    )
    respx.get(url__regex=r"https://api\.adzuna\.com/.*").mock(
        return_value=httpx.Response(
            200,
            json={
                "results": [
                    {
                        "id": "adz-500",
                        "title": "Staff Engineer",
                        "company": {"display_name": "Stripe, Inc."},
                        "location": {"display_name": "San Francisco"},
                        "description": "Lead arch",
                        "redirect_url": "https://adzuna.com/jobs/adz-500",
                    }
                ]
            },
        )
    )

    cache = JobCache(str(db_file))
    count = await refresh_jobs(cache=cache)
    assert count == 1
    jobs = cache.list_jobs()
    assert len(jobs) == 1


@pytest.mark.asyncio
@respx.mock
async def test_empty_settings_makes_no_calls(monkeypatch, tmp_path):
    db_file = tmp_path / "test_jobs.sqlite"
    monkeypatch.setattr(settings, "JC_DB_PATH", str(db_file))
    monkeypatch.setattr(settings, "JC_GREENHOUSE_BOARDS", "")
    monkeypatch.setattr(settings, "JC_LEVER_COMPANIES", "")
    monkeypatch.setattr(settings, "JC_ADZUNA_QUERIES", "")

    catch_all = respx.route().mock(return_value=httpx.Response(200))

    cache = JobCache(str(db_file))
    count = await refresh_jobs(cache=cache)
    assert count == 0
    assert not catch_all.called


@pytest.mark.asyncio
async def test_older_than_30_days_removed(tmp_path):
    db_file = tmp_path / "test_jobs.sqlite"
    cache = JobCache(str(db_file))

    fresh_job = Job(
        id="j-fresh",
        source="manual",
        source_id="s1",
        title="Fresh Job",
        company="Acme",
        location="Remote",
        remote="remote",
        job_type="full-time",
        required_skills=[],
        nice_to_have_skills=[],
        description="Fresh",
        url="https://example.com/fresh",
        fetched_at=datetime.now(UTC).isoformat(),
    )
    stale_job = Job(
        id="j-stale",
        source="manual",
        source_id="s2",
        title="Stale Job",
        company="OldCo",
        location="Remote",
        remote="remote",
        job_type="full-time",
        required_skills=[],
        nice_to_have_skills=[],
        description="Stale",
        url="https://example.com/stale",
        fetched_at=(datetime.now(UTC) - timedelta(days=35)).isoformat(),
    )

    cache.upsert_jobs([fresh_job, stale_job])
    assert len(cache.list_jobs()) == 2

    deleted = cache.delete_older_than(30)
    assert deleted == 1
    remaining = cache.list_jobs()
    assert len(remaining) == 1
    assert remaining[0].id == "j-fresh"
