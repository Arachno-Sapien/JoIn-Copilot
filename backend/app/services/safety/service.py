from app.llm.client import acomplete
from app.schemas.job import Job
from app.schemas.scam import ScamCheckResponse, ScamModelOutput
from app.services.safety.injection import detect_prompt_injection
from app.services.safety.rules import check_rule_signals


async def check_job_safety(job: Job) -> ScamCheckResponse:
    rule_signals = check_rule_signals(job)
    injection_warning = detect_prompt_injection(job.description)

    inputs = {
        "job_title": job.title,
        "job_company": job.company,
        "job_description": job.description,
    }

    raw = await acomplete(
        tier="small",
        template="scam_check.v1.md",
        inputs=inputs,
        schema=ScamModelOutput,
    )

    if isinstance(raw, ScamModelOutput):
        llm_output = raw
    elif isinstance(raw, dict):
        llm_output = ScamModelOutput.model_validate(raw)
    else:
        llm_output = ScamModelOutput(risk_level="low", flags=[], reasoning=None)

    # Combine rule signals and LLM risk assessment
    combined_risk = "low"
    if len(rule_signals) >= 2 or llm_output.risk_level == "high":
        combined_risk = "high"
    elif len(rule_signals) >= 1 or llm_output.risk_level == "medium" or injection_warning is not None:
        combined_risk = "medium"
    else:
        combined_risk = "low"

    # Compile reasons
    reasons: list[str] = []
    reasons.extend(rule_signals)
    for flag in llm_output.flags:
        if flag not in reasons:
            reasons.append(flag)

    if llm_output.reasoning and llm_output.reasoning not in reasons:
        reasons.append(llm_output.reasoning)

    # In medium and high risk, ensure reasons is never empty
    if combined_risk in ["medium", "high"] and len(reasons) == 0:
        reasons.append("Identified by safety classifier as potentially risky.")

    return ScamCheckResponse(
        job_id=job.id,
        risk_level=combined_risk,
        reasons=reasons,
        rule_signals=rule_signals,
        llm_flags=llm_output.flags,
        injection_warning=injection_warning,
    )
