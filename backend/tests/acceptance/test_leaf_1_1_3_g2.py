import hashlib

import pytest
import respx

from app.schemas.job import Job
from app.services.jobs.greenhouse import GreenhouseFetcher, map_greenhouse_response
from app.services.jobs.lever import LeverFetcher, map_lever_response

GREENHOUSE_SAMPLE_RESPONSE = {
    "jobs": [
        {
            "id": 4012345,
            "title": "Software Engineer, Frontend",
            "location": {"name": "Remote, US"},
            "updated_at": "2026-10-14T08:00:00Z",
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/4012345",
            "content": "<p>We are looking for a frontend developer proficient in React.</p>",
        },
        {
            "id": 4012346,
            "title": "Software Engineer, Backend",
            "location": {"name": "New York, NY"},
            "updated_at": "2026-10-14T09:00:00Z",
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/4012346",
            "content": "<p>Looking for backend engineer with Python skills.</p>",
        },
    ]
}

LEVER_SAMPLE_RESPONSE = [
    {
        "id": "lever-job-001",
        "text": "Product Designer",
        "categories": {
            "location": "San Francisco, CA",
            "commitment": "Full time",
            "team": "Design",
        },
        "descriptionPlain": "We are seeking a skilled product designer with Figma mastery.",
        "hostedUrl": "https://jobs.lever.co/figma/lever-job-001",
        "createdAt": 1729000000000,
    },
    {
        "id": "lever-job-002",
        "text": "Frontend Intern",
        "categories": {
            "location": "Remote",
            "commitment": "Intern",
            "team": "Engineering",
        },
        "descriptionPlain": "Frontend intern working with React and TypeScript.",
        "hostedUrl": "https://jobs.lever.co/figma/lever-job-002",
        "createdAt": 1729100000000,
    },
]


def test_greenhouse_mapping():
    jobs = map_greenhouse_response("acme", GREENHOUSE_SAMPLE_RESPONSE)
    assert len(jobs) == 2
    for job in jobs:
        assert isinstance(job, Job)
        assert job.source == "greenhouse"
        assert job.company == "acme"
        expected_id = hashlib.sha1(f"greenhouse{job.source_id}".encode()).hexdigest()
        assert job.id == expected_id
        Job.model_validate(job.model_dump())

    assert jobs[0].source_id == "4012345"
    assert jobs[0].title == "Software Engineer, Frontend"
    assert jobs[0].remote == "remote"
    assert jobs[0].url == "https://boards.greenhouse.io/acme/jobs/4012345"


def test_lever_mapping():
    jobs = map_lever_response("figma", LEVER_SAMPLE_RESPONSE)
    assert len(jobs) == 2
    for job in jobs:
        assert isinstance(job, Job)
        assert job.source == "lever"
        assert job.company == "figma"
        expected_id = hashlib.sha1(f"lever{job.source_id}".encode()).hexdigest()
        assert job.id == expected_id
        Job.model_validate(job.model_dump())

    assert jobs[0].source_id == "lever-job-001"
    assert jobs[0].title == "Product Designer"
    assert jobs[0].job_type == "full-time"
    assert jobs[1].source_id == "lever-job-002"
    assert jobs[1].job_type == "internship"
    assert jobs[1].remote == "remote"


@pytest.mark.asyncio
async def test_greenhouse_and_lever_fetchers_mocked():
    gh_fetcher = GreenhouseFetcher()
    with respx.mock(assert_all_called=True) as respx_mock:
        respx_mock.get("https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true").respond(
            status_code=200,
            json=GREENHOUSE_SAMPLE_RESPONSE,
        )
        gh_jobs = await gh_fetcher.fetch_board_jobs("acme")
        assert len(gh_jobs) == 2
        assert gh_jobs[0].source == "greenhouse"

    lever_fetcher = LeverFetcher()
    with respx.mock(assert_all_called=True) as respx_mock:
        respx_mock.get("https://api.lever.co/v0/postings/figma").respond(
            status_code=200,
            json=LEVER_SAMPLE_RESPONSE,
        )
        lever_jobs = await lever_fetcher.fetch_postings("figma")
        assert len(lever_jobs) == 2
        assert lever_jobs[0].source == "lever"
