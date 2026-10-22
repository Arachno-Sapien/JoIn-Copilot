import hashlib
import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.schemas.job import Job


def _clean_html(raw_html: str) -> str:
    clean = re.sub(r"<[^>]+>", " ", raw_html)
    return " ".join(clean.split())


def _detect_remote(title: str, location: str, description: str) -> str:
    combined = f"{title} {location} {description}".lower()
    if "remote" in combined or "work from home" in combined or "wfh" in combined:
        return "remote"
    if "hybrid" in combined:
        return "hybrid"
    if "onsite" in combined or "on-site" in combined or "in-office" in combined:
        return "onsite"
    return "unknown"


def _detect_job_type(title: str, description: str) -> str:
    combined = f"{title} {description}".lower()
    if "intern" in combined or "internship" in combined:
        return "internship"
    if "contract" in combined or "freelance" in combined or "temporary" in combined:
        return "contract"
    if "full time" in combined or "full-time" in combined or "permanent" in combined:
        return "full-time"
    return "unknown"


def map_greenhouse_job(company: str, raw_item: dict[str, Any]) -> Job:
    source = "greenhouse"
    source_id = str(raw_item.get("id", ""))
    job_id = hashlib.sha1(f"{source}{source_id}".encode()).hexdigest()

    title = raw_item.get("title", "").strip()
    loc_obj = raw_item.get("location")
    location = loc_obj.get("name", "") if isinstance(loc_obj, dict) else str(loc_obj or "")

    content = raw_item.get("content", "")
    description = _clean_html(content)
    url = raw_item.get("absolute_url", "")
    posted_at = raw_item.get("updated_at")

    remote = _detect_remote(title, location, description)
    job_type = _detect_job_type(title, description)
    fetched_at = datetime.now(UTC).isoformat()

    return Job(
        id=job_id,
        source=source,
        source_id=source_id,
        url=url,
        title=title,
        company=company,
        location=location,
        remote=remote,  # type: ignore[arg-type]
        job_type=job_type,  # type: ignore[arg-type]
        required_skills=[],
        nice_to_have_skills=[],
        experience_years_min=None,
        description=description,
        posted_at=posted_at,
        deadline=None,
        fetched_at=fetched_at,
    )


def map_greenhouse_response(company: str, data: dict[str, Any]) -> list[Job]:
    jobs = data.get("jobs", [])
    return [map_greenhouse_job(company, j) for j in jobs]


class GreenhouseFetcher:
    async def fetch_board_jobs(self, board_token: str) -> list[Job]:
        url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()
            return map_greenhouse_response(board_token, data)
