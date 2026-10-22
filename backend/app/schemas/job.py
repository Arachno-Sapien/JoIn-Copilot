from typing import Literal

from pydantic import BaseModel, Field


class Job(BaseModel):
    id: str
    source: Literal["adzuna", "greenhouse", "lever", "manual"]
    source_id: str
    url: str
    title: str
    company: str
    location: str
    remote: Literal["remote", "onsite", "hybrid", "unknown"] = "unknown"
    job_type: Literal["internship", "full-time", "contract", "unknown"] = "unknown"
    required_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    experience_years_min: float | int | None = None
    description: str
    posted_at: str | None = None
    deadline: str | None = None
    fetched_at: str
