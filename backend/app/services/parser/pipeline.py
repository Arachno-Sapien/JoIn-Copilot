from fastapi import HTTPException
from pydantic import ValidationError

from app.llm.client import acomplete
from app.schemas.profile import Profile
from app.services.parser.assign_ids import assign_stable_bullet_ids
from app.services.parser.extractor import ImageOnlyPDFError, extract_text_from_pdf


async def parse_resume_pipeline(pdf_bytes: bytes) -> Profile:
    try:
        text = extract_text_from_pdf(pdf_bytes)
    except ImageOnlyPDFError as err:
        raise HTTPException(
            status_code=422,
            detail="Scanned or image-only PDF detected. Please upload a text-based resume.",
        ) from err

    # First attempt with small model
    try:
        raw_profile = await acomplete(
            tier="small",
            template="parse_resume.v1.md",
            inputs={"resume_text": text},
            schema=Profile,
        )
    except (ValidationError, Exception) as first_err:  # noqa: BLE001
        # Retry once with validation error in prompt
        try:
            raw_profile = await acomplete(
                tier="small",
                template="parse_resume_retry.v1.md",
                inputs={"resume_text": text, "validation_error": str(first_err)},
                schema=Profile,
            )
        except Exception as second_err:
            raise HTTPException(
                status_code=422,
                detail=f"Resume schema validation failed after retry: {second_err}",
            ) from second_err

    # Ensure profile is an instance of Profile
    if not isinstance(raw_profile, Profile):
        try:
            profile = Profile.model_validate(raw_profile)
        except ValidationError as val_err:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid profile output: {val_err}",
            ) from val_err
    else:
        profile = raw_profile

    # Assign stable bullet and section IDs
    return assign_stable_bullet_ids(profile)
