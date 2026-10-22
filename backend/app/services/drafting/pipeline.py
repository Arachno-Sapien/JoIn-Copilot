from app.schemas.draft import ClaimWithVerdict, DraftResponse, FlaggedSpan
from app.schemas.job import Job
from app.schemas.profile import Profile
from app.services.checker.claims import extract_claims
from app.services.checker.evidence import retrieve_claim_evidence
from app.services.checker.judge import judge_claim
from app.services.drafting.draft import check_cited_ids, generate_draft
from app.services.drafting.rewrite import generate_rewrite_offer


async def draft_application_pipeline(job: Job, question: str, profile: Profile) -> DraftResponse:
    # Step 1: Draft with strong model
    draft_text = await generate_draft(job, question, profile)

    # Step 2: Extract atomic factual claims with small model
    claims_list = await extract_claims(draft_text)

    # Step 3 & 4: Retrieve evidence and judge each claim
    claims_with_verdicts: list[ClaimWithVerdict] = []
    for c in claims_list:
        valid_ids, invalid_ids = check_cited_ids(c.cited_bullet_ids, profile)
        evidence = retrieve_claim_evidence(c.claim_text, valid_ids, profile)
        verdict = await judge_claim(c.claim_text, valid_ids, evidence)

        # Flag if judge marks unsupported or cites non-existent IDs
        is_flagged = verdict.is_flagged or bool(invalid_ids)
        reason = verdict.reason
        if invalid_ids:
            reason += f" (Cited invalid bullet IDs: {', '.join(invalid_ids)})"

        claims_with_verdicts.append(
            ClaimWithVerdict(
                claim=c.claim_text,
                verdict=verdict.verdict,
                reason=reason,
                cited_ids=c.cited_bullet_ids,
                is_flagged=is_flagged,
            )
        )

    # Step 5: Identify flagged spans in draft text
    flagged_spans: list[FlaggedSpan] = []
    for cv in claims_with_verdicts:
        if cv.is_flagged:
            idx = draft_text.find(cv.claim)
            if idx != -1:
                flagged_spans.append(
                    FlaggedSpan(
                        text=cv.claim,
                        start=idx,
                        end=idx + len(cv.claim),
                        reason=cv.reason,
                    )
                )
            else:
                flagged_spans.append(
                    FlaggedSpan(
                        text=cv.claim,
                        start=None,
                        end=None,
                        reason=cv.reason,
                    )
                )

    # Step 6: Rewrite offer
    if flagged_spans:
        rewrite = await generate_rewrite_offer(draft_text, claims_with_verdicts, profile)
    else:
        rewrite = draft_text

    # Step 7: Output validation - check for unauthorized email addresses and URLs
    import re

    # Check emails
    allowed_email = profile.email.lower() if profile.email else ""
    for m in re.finditer(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", draft_text):
        email = m.group(0)
        if email.lower() != allowed_email:
            flagged_spans.append(
                FlaggedSpan(
                    text=email,
                    start=m.start(),
                    end=m.end(),
                    reason=f"Draft contains unauthorized email address: {email}",
                )
            )

    # Check URLs
    allowed_urls = {str(url).lower().rstrip('/') for url in profile.links.values()}
    for m in re.finditer(r"https?://[^\s<>\"']+", draft_text):
        url = m.group(0)
        clean_url = url.lower().rstrip('/')
        if clean_url not in allowed_urls:
            flagged_spans.append(
                FlaggedSpan(
                    text=url,
                    start=m.start(),
                    end=m.end(),
                    reason=f"Draft contains unauthorized URL: {url}",
                )
            )

    return DraftResponse(
        draft=draft_text,
        claims=claims_with_verdicts,
        flagged_spans=flagged_spans,
        rewrite=rewrite,
    )
