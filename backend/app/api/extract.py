import hashlib
from datetime import UTC, datetime

from fastapi import APIRouter

from app.llm.client import acomplete
from app.schemas.extract import ExtractJobRequest, JobExtraction
from app.schemas.job import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/extract", response_model=Job)
async def extract_job_endpoint(payload: ExtractJobRequest) -> Job:
    # Small tier model call with versioned prompt
    extraction = await acomplete(
        tier="small",
        template="extract_job.v1.md",
        inputs={"page_text": payload.text},
        schema=JobExtraction,
    )

    source = "manual"
    # Stable source_id derived from the job posting URL
    source_id = hashlib.sha1(payload.url.encode("utf-8")).hexdigest()[:16]
    job_id = hashlib.sha1(f"{source}{source_id}".encode()).hexdigest()
    fetched_at = datetime.now(UTC).isoformat()

    return Job(
        id=job_id,
        source=source,
        source_id=source_id,
        url=payload.url,
        title=extraction.title,
        company=extraction.company,
        location=extraction.location,
        remote=extraction.remote,
        job_type=extraction.job_type,
        required_skills=extraction.required_skills,
        nice_to_have_skills=extraction.nice_to_have_skills,
        experience_years_min=extraction.experience_years_min,
        description=extraction.description,
        posted_at=extraction.posted_at,
        deadline=extraction.deadline,
        fetched_at=fetched_at,
    )
