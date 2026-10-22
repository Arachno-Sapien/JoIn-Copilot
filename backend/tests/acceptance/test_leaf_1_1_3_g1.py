import hashlib
import pytest
import respx
from httpx import Response

from app.schemas.job import Job
from app.services.jobs.adzuna import AdzunaFetcher, map_adzuna_job, map_adzuna_response

ADZUNA_SAMPLE_RESPONSE = {
    "results": [
        {
            "id": "49123456",
            "title": "Junior Python Developer",
            "company": {"display_name": "Acme Tech Solutions"},
            "location": {"display_name": "Bangalore, India", "area": ["India", "Karnataka", "Bangalore"]},
            "description": "Looking for Junior Python Developer with FastAPI and SQLite experience.",
            "created": "2026-10-15T12:00:00Z",
            "redirect_url": "https://www.adzuna.in/land/ad/49123456",
            "contract_time": "full_time",
            "salary_min": 600000.0,
        },
        {
            "id": "49123457",
            "title": "Frontend Engineer Intern",
            "company": {"display_name": "Beta Labs Pvt Ltd"},
            "location": {"display_name": "Remote", "area": ["Remote"]},
            "description": "Internship for React and TypeScript enthusiasts.",
            "created": "2026-10-16T09:30:00Z",
            "redirect_url": "https://www.adzuna.in/land/ad/49123457",
            "contract_time": "internship",
        },
    ]
}


def test_map_adzuna_job_direct():
    raw_item = ADZUNA_SAMPLE_RESPONSE["results"][0]
    job = map_adzuna_job(raw_item)

    assert isinstance(job, Job)
    assert job.source == "adzuna"
    assert job.source_id == "49123456"

    # id is sha1 of source plus source_id (design §5.2)
    expected_id = hashlib.sha1("adzuna49123456".encode("utf-8")).hexdigest()
    assert job.id == expected_id

    assert job.title == "Junior Python Developer"
    assert job.company == "Acme Tech Solutions"
    assert job.location == "Bangalore, India"
    assert job.url == "https://www.adzuna.in/land/ad/49123456"
    assert job.description == raw_item["description"]
    assert job.posted_at == "2026-10-15T12:00:00Z"
    assert job.fetched_at is not None
    assert job.job_type == "full-time"

    # Verify Pydantic validation
    validated = Job.model_validate(job.model_dump())
    assert validated.id == expected_id


def test_map_adzuna_response_all_results():
    jobs = map_adzuna_response(ADZUNA_SAMPLE_RESPONSE)
    assert len(jobs) == 2
    assert all(isinstance(j, Job) for j in jobs)
    assert all(j.source == "adzuna" for j in jobs)
    assert jobs[0].source_id == "49123456"
    assert jobs[1].source_id == "49123457"
    assert jobs[1].job_type == "internship"
    assert jobs[1].remote == "remote"


@pytest.mark.asyncio
async def test_adzuna_fetcher_with_respx_mock():
    fetcher = AdzunaFetcher(app_id="test_app_id", app_key="test_app_key", country="in")

    with respx.mock(assert_all_called=True) as respx_mock:
        respx_mock.get(
            "https://api.adzuna.com/v1/api/jobs/in/search/1",
        ).respond(
            status_code=200,
            json=ADZUNA_SAMPLE_RESPONSE,
        )

        jobs = await fetcher.fetch_jobs(what="python", where="bangalore")
        assert len(jobs) == 2
        assert jobs[0].source == "adzuna"
        assert jobs[0].company == "Acme Tech Solutions"
        assert jobs[0].id == hashlib.sha1("adzuna49123456".encode("utf-8")).hexdigest()
