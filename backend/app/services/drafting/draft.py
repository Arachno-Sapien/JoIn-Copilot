from app.llm.client import acomplete
from app.schemas.draft import DraftModelOutput
from app.schemas.job import Job
from app.schemas.profile import Bullet, Profile


def get_all_profile_bullets(profile: Profile) -> list[Bullet]:
    bullets: list[Bullet] = []
    for exp in profile.experience:
        bullets.extend(exp.bullets)
    for proj in profile.projects:
        bullets.extend(proj.bullets)
    return bullets


def build_draft_prompt_inputs(job: Job, question: str, profile: Profile) -> dict[str, str]:
    all_bullets = get_all_profile_bullets(profile)
    bullet_lines = [f"[{b.id}] {b.text}" for b in all_bullets]
    profile_bullets_str = "\n".join(bullet_lines) if bullet_lines else "None provided."

    skill_lines = [f"{s.name} ({s.level})" for s in profile.skills]
    profile_skills_str = ", ".join(skill_lines) if skill_lines else "None specified."

    return {
        "job_title": job.title,
        "job_company": job.company,
        "job_description": job.description,
        "question": question,
        "profile_name": profile.name,
        "profile_skills": profile_skills_str,
        "profile_bullets": profile_bullets_str,
    }


def check_cited_ids(cited_ids: list[str], profile: Profile) -> tuple[list[str], list[str]]:
    valid_id_set = {b.id for b in get_all_profile_bullets(profile)}
    valid: list[str] = []
    invalid: list[str] = []

    for cid in cited_ids:
        if cid in valid_id_set:
            valid.append(cid)
        else:
            invalid.append(cid)

    return valid, invalid


async def generate_draft(job: Job, question: str, profile: Profile) -> str:
    inputs = build_draft_prompt_inputs(job, question, profile)
    raw = await acomplete(
        tier="strong",
        template="draft.v1.md",
        inputs=inputs,
        schema=DraftModelOutput,
    )
    if isinstance(raw, DraftModelOutput):
        return raw.draft_text
    elif isinstance(raw, dict):
        return raw.get("draft_text", "")
    return str(raw)
