from app.llm.client import acomplete
from app.schemas.draft import ClaimVerdict
from app.schemas.profile import Bullet


async def judge_claim(
    claim: str,
    cited_ids: list[str],
    evidence: list[Bullet],
) -> ClaimVerdict:
    evidence_str = (
        "\n".join(f"[{b.id}] {b.text}" for b in evidence)
        if evidence
        else "No matching evidence bullets found in candidate profile."
    )

    inputs = {
        "claim_text": claim,
        "evidence_bullets": evidence_str,
    }

    raw = await acomplete(
        tier="small",
        template="judge.v1.md",
        inputs=inputs,
        schema=ClaimVerdict,
    )

    if isinstance(raw, ClaimVerdict):
        verdict = raw
    elif isinstance(raw, dict):
        verdict = ClaimVerdict.model_validate(raw)
    else:
        verdict = ClaimVerdict(verdict="unsupported", reason=str(raw))

    # Any unsupported claim is flagged
    verdict.is_flagged = verdict.verdict == "unsupported"
    return verdict
