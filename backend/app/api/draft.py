from fastapi import APIRouter

from app.schemas.draft import DraftRequest, DraftResponse
from app.services.drafting.pipeline import draft_application_pipeline

router = APIRouter(tags=["draft"])


@router.post("/draft", response_model=DraftResponse)
async def draft_answer(request: DraftRequest) -> DraftResponse:
    return await draft_application_pipeline(
        job=request.job,
        question=request.question,
        profile=request.profile,
    )
