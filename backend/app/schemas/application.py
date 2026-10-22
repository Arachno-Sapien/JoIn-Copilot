from typing import Literal

from pydantic import BaseModel, Field


class JobSnapshot(BaseModel):
    title: str
    company: str
    url: str
    source: str


class Answer(BaseModel):
    question: str
    answer: str
    flags: list[str] = Field(default_factory=list)


ApplicationStatus = Literal[
    "applied",
    "viewed",
    "assessment",
    "interview",
    "offer",
    "rejected",
    "no_response",
    "withdrawn",
]


class StatusHistoryEntry(BaseModel):
    status: ApplicationStatus
    at: str
    source: Literal["user", "gmail", "portal", "auto"] = "user"


class Application(BaseModel):
    schema_version: int = 1
    id: str
    job_id: str
    job_snapshot: JobSnapshot
    applied_at: str
    fit_score: float | int = 0
    missing_skills: list[str] = Field(default_factory=list)
    resume_version: str
    answers: list[Answer] = Field(default_factory=list)
    status: ApplicationStatus
    status_history: list[StatusHistoryEntry] = Field(default_factory=list)
    notes: str = ""
