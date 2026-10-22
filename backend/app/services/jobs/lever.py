import hashlib
from datetime import UTC, datetime
from typing import Any

import httpx

from app.schemas.job import Job


def _detect_remote(title: str, location: str, description: str) -> str:
    combined = f"{title} {location} {description}".lower()
    if "remote" in combined or "work from home" in combined or "wfh" in combined:
        return "remote"
    if "hybrid" in combined:
        return "hybrid"
    if "onsite" in combined or "on-site" in combined or "in-office" in combined:
        return "onsite"
    return "unknown"


def _detect_job_type(title: str, commitment: str, description: str) -> str:
    combined = f"{title} {commitment} {description}".lower()
    if "intern" in combined:
        return "internship"
    if "contract" in combined or "freelance" in combined:
        return "contract"
    if "full time" in combined or "full-time" in combined or "permanent" in combined:
        return "full-time"
    return "unknown"


def _parse_created_at(val: Any) -> str | None:
    if not val:
        return None
    if isinstance(val, (int, float)):
        # Lever gives timestamps in milliseconds
        dt = datetime.fromtimestamp(val / 1000.0, tz=UTC)
        return dt.isoformat()
    return str(val)


def map_lever_job(company: str, raw_item: dict[str, Any]) -> Job:
    source = "lever"
    source_id = str(raw_item.get("id", ""))
    job_id = hashlib.sha1(f"{source}{source_id}".encode()).hexdigest()

    title = raw_item.get("text", "").strip()
    cats = raw_item.get("categories") or {}
    location = cats.get("location", "") if isinstance(cats, dict) else ""
    commitment = cats.get("commitment", "") if isinstance(cats, dict) else ""

    description = raw_item.get("descriptionPlain") or raw_item.get("description", "")
    url = raw_item.get("hostedUrl", "")
    posted_at = _parse_created_at(raw_item.get("createdAt"))

    remote = _detect_remote(title, location, description)
    job_type = _detect_job_type(title, commitment, description)
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


def map_lever_response(company: str, data: list[dict[str, Any]] | dict[str, Any]) -> list[Job]:
    items = data if isinstance(data, list) else data.get("postings", [])
    return [map_lever_job(company, j) for j in items]


class LeverFetcher:
    async def fetch_postings(self, company: str) -> list[Job]:
        url = f"https://api.lever.co/v0/postings/{company}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()
            return map_lever_response(company, data)
