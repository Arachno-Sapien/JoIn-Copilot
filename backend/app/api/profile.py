from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.profile import Profile
from app.services.parser.pipeline import parse_resume_pipeline

router = APIRouter(prefix="/profile", tags=["profile"])


@router.post("/parse", response_model=Profile)
async def parse_profile_endpoint(file: Annotated[UploadFile, File()]) -> Profile:
    if (not file.filename or not file.filename.lower().endswith(".pdf")) and file.content_type not in (
        "application/pdf",
        "application/octet-stream",
    ):
        raise HTTPException(status_code=422, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(
            status_code=422,
            detail="Scanned or image-only PDF detected. Please upload a text-based resume.",
        )

    # Process through PyMuPDF and small model structured output with retry
    profile = await parse_resume_pipeline(pdf_bytes)

    # Personal data is never stored on the server; returned directly to browser
    return profile
