import hashlib
import os
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


def _detect_job_type(title: str, contract_time: str | None, description: str) -> str:
    combined = f"{title} {contract_time or ''} {description}".lower()
    if "intern" in combined or "internship" in combined:
        return "internship"
    if "contract" in combined or "freelance" in combined or "temporary" in combined:
        return "contract"
    if "full_time" in combined or "full-time" in combined or "permanent" in combined:
        return "full-time"
    return "unknown"


def map_adzuna_job(raw_item: dict[str, Any]) -> Job:
    source = "adzuna"
    source_id = str(raw_item.get("id", ""))
    job_id = hashlib.sha1(f"{source}{source_id}".encode()).hexdigest()

    title = raw_item.get("title", "").strip()
    company_obj = raw_item.get("company")
    company = (
        company_obj.get("display_name", "")
        if isinstance(company_obj, dict)
        else str(company_obj or "")
    )

    loc_obj = raw_item.get("location")
    location = loc_obj.get("display_name", "") if isinstance(loc_obj, dict) else str(loc_obj or "")

    description = raw_item.get("description", "")
    url = raw_item.get("redirect_url", "")
    posted_at = raw_item.get("created")
    contract_time = raw_item.get("contract_time")

    remote = _detect_remote(title, location, description)
    job_type = _detect_job_type(title, contract_time, description)

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


def map_adzuna_response(data: dict[str, Any]) -> list[Job]:
    results = data.get("results", [])
    return [map_adzuna_job(item) for item in results]


class AdzunaFetcher:
    def __init__(
        self,
        app_id: str | None = None,
        app_key: str | None = None,
        country: str = "in",
    ) -> None:
        self.app_id = app_id or os.environ.get("ADZUNA_APP_ID", "")
        self.app_key = app_key or os.environ.get("ADZUNA_APP_KEY", "")
        self.country = country

    async def fetch_jobs(
        self,
        what: str = "",
        where: str = "",
        page: int = 1,
    ) -> list[Job]:
        url = f"https://api.adzuna.com/v1/api/jobs/{self.country}/search/{page}"
        params: dict[str, Any] = {
            "app_id": self.app_id,
            "app_key": self.app_key,
        }
        if what:
            params["what"] = what
        if where:
            params["where"] = where

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()
            return map_adzuna_response(data)
