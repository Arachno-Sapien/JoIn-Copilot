import re

from rapidfuzz import fuzz

from app.schemas.job import Job

# Regex pattern for legal/corporate suffixes
COMPANY_SUFFIX_PATTERN = re.compile(
    r"\b(pvt\.?\s*ltd\.?|private\s*limited|ltd\.?|limited|inc\.?|incorporated|llc|corp\.?|corporation|co\.?)\b",
    re.IGNORECASE,
)


def normalize_company_name(name: str) -> str:
    cleaned = name.strip()
    cleaned = COMPANY_SUFFIX_PATTERN.sub("", cleaned)
    # Remove non-alphanumeric except space
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    # Collapse multiple whitespaces
    tokens = cleaned.lower().split()
    return " ".join(tokens)


def _normalize_title(title: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", title)
    return " ".join(cleaned.lower().split())


def _are_duplicate_jobs(job_a: Job, job_b: Job, threshold: float = 85.0) -> bool:
    norm_comp_a = normalize_company_name(job_a.company)
    norm_comp_b = normalize_company_name(job_b.company)

    # Company match check
    if norm_comp_a != norm_comp_b:
        comp_similarity = fuzz.token_sort_ratio(norm_comp_a, norm_comp_b)
        if comp_similarity < 90.0:
            return False

    # Title match check
    title_a = _normalize_title(job_a.title)
    title_b = _normalize_title(job_b.title)

    title_similarity = fuzz.token_sort_ratio(title_a, title_b)
    return title_similarity >= threshold


def deduplicate_jobs(jobs: list[Job], threshold: float = 85.0) -> list[Job]:
    deduped: list[Job] = []

    for job in jobs:
        merged = False
        for i, existing in enumerate(deduped):
            if _are_duplicate_jobs(existing, job, threshold=threshold):
                # Prefer direct applicant tracking systems over aggregators
                source_priority = {"greenhouse": 3, "lever": 3, "manual": 2, "adzuna": 1}
                priority_existing = source_priority.get(existing.source, 0)
                priority_new = source_priority.get(job.source, 0)

                primary = job if priority_new > priority_existing else existing
                secondary = existing if priority_new > priority_existing else job

                # Combine skills and take longest description
                combined_skills = list(
                    dict.fromkeys(primary.required_skills + secondary.required_skills)
                )
                combined_nice = list(
                    dict.fromkeys(primary.nice_to_have_skills + secondary.nice_to_have_skills)
                )
                desc = (
                    primary.description
                    if len(primary.description) >= len(secondary.description)
                    else secondary.description
                )

                merged_job = primary.model_copy(
                    update={
                        "required_skills": combined_skills,
                        "nice_to_have_skills": combined_nice,
                        "description": desc,
                        "fetched_at": max(existing.fetched_at, job.fetched_at),
                    }
                )
                deduped[i] = merged_job
                merged = True
                break

        if not merged:
            deduped.append(job)

    return deduped
