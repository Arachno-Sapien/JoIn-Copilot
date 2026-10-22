from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas.scam import ScamCheckResponse
from app.services.jobs.cache import JobCache
from app.services.safety.service import check_job_safety

router = APIRouter(prefix="/jobs", tags=["safety"])


@router.post("/{job_id}/scam-check", response_model=ScamCheckResponse)
async def check_job_scam(job_id: str) -> ScamCheckResponse:
    cache = JobCache(db_path=settings.JC_DB_PATH)
    job = cache.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    return await check_job_safety(job)
