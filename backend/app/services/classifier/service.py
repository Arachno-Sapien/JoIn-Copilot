import json

from app.llm.client import acomplete
from app.schemas.email import CandidateApplication, EmailClassifyResponse, EmailInput


def _format_candidates(candidates: list[CandidateApplication]) -> str:
    if not candidates:
        return "No candidate applications tracked."
    return json.dumps([c.model_dump() for c in candidates], indent=2)


async def classify_email(
    email: EmailInput,
    candidates: list[CandidateApplication],
) -> EmailClassifyResponse:
    inputs = {
        "candidate_applications": _format_candidates(candidates),
        "email_sender": email.sender,
        "email_subject": email.subject,
        "email_date": email.date,
        "email_body": email.body,
    }

    raw = await acomplete(
        tier="small",
        template="classify_email.v1.md",
        inputs=inputs,
        schema=EmailClassifyResponse,
    )

    if isinstance(raw, EmailClassifyResponse):
        result = raw
    elif isinstance(raw, dict):
        result = EmailClassifyResponse.model_validate(raw)
    else:
        raise TypeError(f"Unexpected output from classifier LLM: {type(raw)}")

    # Ensure matched_application_id is actually in candidate list if specified
    valid_candidate_ids = {c.id for c in candidates}
    if result.matched_application_id and result.matched_application_id not in valid_candidate_ids:
        # If model returned an unknown ID, clear it or match by company if obvious
        matched_id = None
        for c in candidates:
            if c.company.lower() in email.subject.lower() or c.company.lower() in email.sender.lower():
                matched_id = c.id
                break
        result.matched_application_id = matched_id

    return result
