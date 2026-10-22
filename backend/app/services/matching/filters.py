import re
from datetime import datetime

from app.schemas.job import Job
from app.schemas.profile import Profile


def _parse_year_month(date_str: str) -> tuple[int, int] | None:
    date_str = date_str.strip().lower()
    if date_str in ("present", "current", "now"):
        now = datetime.now()
        return now.year, now.month

    # Try YYYY-MM
    m = re.match(r"^(\d{4})[-/](\d{1,2})", date_str)
    if m:
        return int(m.group(1)), int(m.group(2))

    # Try YYYY
    m = re.match(r"^(\d{4})", date_str)
    if m:
        return int(m.group(1)), 1

    return None


def calculate_profile_experience_years(profile: Profile) -> float:
    total_months = 0
    for exp in profile.experience:
        start_tuple = _parse_year_month(exp.start) if exp.start else None
        end_tuple = _parse_year_month(exp.end) if exp.end else None

        if start_tuple and end_tuple:
            s_year, s_month = start_tuple
            e_year, e_month = end_tuple
            months = (e_year - s_year) * 12 + (e_month - s_month)
            if months > 0:
                total_months += months
        elif start_tuple and not end_tuple:
            # Assume at least 6 months if only start is present
            total_months += 6

    return round(total_months / 12.0, 2)


def hard_filter_jobs(jobs: list[Job], profile: Profile) -> list[Job]:
    prefs = profile.preferences
    avoid_keywords = [kw.strip().lower() for kw in (prefs.avoid_keywords or []) if kw.strip()]
    pref_locations = [loc.strip().lower() for loc in (prefs.locations or []) if loc.strip()]
    pref_remote = (prefs.remote or "any").strip().lower()
    pref_job_types = [jt.strip().lower() for jt in (prefs.job_types or []) if jt.strip()]
    profile_exp = calculate_profile_experience_years(profile)

    retained: list[Job] = []

    for job in jobs:
        # 1. Avoid keywords rule
        if avoid_keywords:
            text_to_check = f"{job.title} {job.company} {job.description}".lower()
            if any(re.search(rf"\b{re.escape(kw)}\b", text_to_check) or kw in text_to_check for kw in avoid_keywords):
                continue

        # 2. Remote preference rule
        job_remote = (job.remote or "unknown").lower()
        if pref_remote == "remote" and job_remote != "remote":
            continue

        # 3. Location rule
        if pref_locations and job_remote != "remote":
            job_loc = (job.location or "").lower()
            matches_location = any(loc in job_loc for loc in pref_locations)
            if not matches_location:
                continue

        # 4. Job type rule
        if pref_job_types:
            job_type = (job.job_type or "unknown").lower()
            if job_type != "unknown" and job_type not in pref_job_types:
                continue

        # 5. Minimum experience rule
        if job.experience_years_min is not None and profile_exp < job.experience_years_min:
            continue

        retained.append(job)

    return retained
