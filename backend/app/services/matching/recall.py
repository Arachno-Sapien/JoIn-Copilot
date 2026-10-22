from app.schemas.job import Job
from app.schemas.profile import Profile
from app.schemas.search import CandidateMatch
from app.services.matching.embeddings import EmbeddingService, cosine_similarity


def build_profile_text(profile: Profile) -> str:
    parts: list[str] = []
    if profile.skills:
        parts.append("Skills: " + ", ".join(s.name for s in profile.skills))
    for exp in profile.experience:
        bullet_texts = " ".join(b.text for b in exp.bullets)
        parts.append(f"{exp.role} at {exp.org}: {bullet_texts}")
    for proj in profile.projects:
        bullet_texts = " ".join(b.text for b in proj.bullets)
        parts.append(f"Project {proj.name}: {bullet_texts}")
    return " ".join(parts)


def build_job_text(job: Job) -> str:
    parts: list[str] = [job.title, job.company]
    if job.required_skills:
        parts.append("Required: " + ", ".join(job.required_skills))
    if job.nice_to_have_skills:
        parts.append("Nice-to-have: " + ", ".join(job.nice_to_have_skills))
    parts.append(job.description)
    return " ".join(parts)


def embedding_recall(
    profile: Profile,
    jobs: list[Job],
    limit: int = 50,
    service: EmbeddingService | None = None,
) -> list[CandidateMatch]:
    if not jobs:
        return []

    embedder = service or EmbeddingService()
    profile_text = build_profile_text(profile)
    profile_vec = embedder.embed_text(profile_text)

    matches: list[CandidateMatch] = []
    for job in jobs:
        job_text = build_job_text(job)
        job_vec = embedder.embed_text(job_text)
        sim = cosine_similarity(profile_vec, job_vec)
        matches.append(CandidateMatch(job=job, similarity=sim))

    # Sort descending by similarity
    matches.sort(key=lambda m: m.similarity, reverse=True)

    # Cap at limit (defaults to 50)
    return matches[:limit]
