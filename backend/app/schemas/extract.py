from typing import Literal

from pydantic import BaseModel, Field


class ExtractJobRequest(BaseModel):
    text: str
    url: str


class JobExtraction(BaseModel):
    title: str = Field(description="Job title")
    company: str = Field(description="Company name")
    location: str = Field(default="Unknown", description="Job location")
    remote: Literal["remote", "onsite", "hybrid", "unknown"] = "unknown"
    job_type: Literal["internship", "full-time", "contract", "unknown"] = "unknown"
    required_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    experience_years_min: float | int | None = None
    description: str = Field(description="Job description or overview")
    posted_at: str | None = None
    deadline: str | None = None
