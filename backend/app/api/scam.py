from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.schemas.job import Job
from app.schemas.scam import ScamCheckResponse
from app.services.jobs.cache import JobCache
from app.services.safety.service import check_job_safety

router = APIRouter(prefix="/jobs", tags=["safety"])


class ScamCheckRequest(BaseModel):
    job: Job | None = None


@router.post("/{job_id}/scam-check", response_model=ScamCheckResponse)
async def check_job_scam(
    job_id: str,
    payload: ScamCheckRequest | None = None,
) -> ScamCheckResponse:
    job = payload.job if payload else None
    if not job:
        cache = JobCache(db_path=settings.JC_DB_PATH)
        job = cache.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    return await check_job_safety(job)
