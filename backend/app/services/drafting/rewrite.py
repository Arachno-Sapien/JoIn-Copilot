from app.llm.client import acomplete
from app.schemas.draft import ClaimWithVerdict, RewriteModelOutput
from app.schemas.profile import Profile
from app.services.drafting.draft import get_all_profile_bullets


async def generate_rewrite_offer(
    original_draft: str,
    claims: list[ClaimWithVerdict],
    profile: Profile,
) -> str:
    # Keep only supported and partly_supported claims
    valid_claims = [c for c in claims if c.verdict in ("supported", "partly_supported")]
    if not valid_claims and claims:
        # If all claims were unsupported, fall back to safe baseline using profile bullets
        supported_claims_str = "None. Do not include any of the unsupported assertions from the draft."
    else:
        supported_claims_str = "\n".join(f"- {c.claim}" for c in valid_claims)

    bullets = get_all_profile_bullets(profile)
    profile_bullets_str = "\n".join(f"[{b.id}] {b.text}" for b in bullets) if bullets else "None"

    inputs = {
        "original_draft": original_draft,
        "supported_claims": supported_claims_str,
        "profile_bullets": profile_bullets_str,
    }

    raw = await acomplete(
        tier="strong",
        template="rewrite.v1.md",
        inputs=inputs,
        schema=RewriteModelOutput,
    )

    if isinstance(raw, RewriteModelOutput):
        return raw.rewritten_text
    elif isinstance(raw, dict):
        return raw.get("rewritten_text", "")
    return str(raw)
