from app.llm.client import acomplete
from app.schemas.draft import ClaimItem, ExtractClaimsResponse


async def extract_claims(draft_text: str) -> list[ClaimItem]:
    raw = await acomplete(
        tier="small",
        template="extract_claims.v1.md",
        inputs={"draft_text": draft_text},
        schema=ExtractClaimsResponse,
    )

    if isinstance(raw, ExtractClaimsResponse):
        return raw.claims
    elif isinstance(raw, dict):
        validated = ExtractClaimsResponse.model_validate(raw)
        return validated.claims
    return []
