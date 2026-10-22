from fastapi import APIRouter

from app.schemas.email import EmailClassifyRequest, EmailClassifyResponse
from app.services.classifier.service import classify_email

router = APIRouter(prefix="/email", tags=["email"])


@router.post("/classify", response_model=EmailClassifyResponse)
async def classify_email_endpoint(request: EmailClassifyRequest) -> EmailClassifyResponse:
    return await classify_email(email=request.email, candidates=request.candidates)
