from app.llm.client import acomplete
from app.schemas.job import Job
from app.schemas.profile import Profile
from app.schemas.search import CandidateMatch, RerankFacts, RerankResult


async def rerank_candidates(
    profile: Profile,
    candidates: list[Job] | list[CandidateMatch],
) -> list[RerankResult]:
    results: list[RerankResult] = []

    profile_skills_str = ", ".join(f"{s.name} ({s.level})" for s in profile.skills)
    profile_exp_str = "\n".join(
        f"{exp.role} at {exp.org} ({exp.start} - {exp.end}): "
        + " ".join(b.text for b in exp.bullets)
        for exp in profile.experience
    )
    profile_summary_str = f"{profile.name} located in {profile.location}."

    for item in candidates:
        job = item.job if isinstance(item, CandidateMatch) else item
        inputs = {
            "job_title": job.title,
            "job_company": job.company,
            "job_description": job.description,
            "job_required_skills": ", ".join(job.required_skills) if job.required_skills else "None specified",
            "job_nice_to_have_skills": ", ".join(job.nice_to_have_skills) if job.nice_to_have_skills else "None specified",
            "job_experience_min": str(job.experience_years_min) if job.experience_years_min is not None else "0",
            "profile_summary": profile_summary_str,
            "profile_skills": profile_skills_str,
            "profile_experience": profile_exp_str,
        }

        raw = await acomplete(
            tier="small",
            template="rerank.v1.md",
            inputs=inputs,
            schema=RerankFacts,
        )

        facts = raw if isinstance(raw, RerankFacts) else RerankFacts.model_validate(raw)
        results.append(RerankResult(job=job, facts=facts))

    return results
