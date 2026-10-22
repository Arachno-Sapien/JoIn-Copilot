from pydantic import BaseModel, Field

from app.schemas.job import Job
from app.schemas.profile import Profile


class RerankFacts(BaseModel):
    matched_required: list[str] = Field(default_factory=list)
    missing_required: list[str] = Field(default_factory=list)
    matched_nice_to_have: list[str] = Field(default_factory=list)
    experience_gap: str = ""
    summary: str = ""


class CandidateMatch(BaseModel):
    job: Job
    similarity: float


class RerankResult(BaseModel):
    job: Job
    facts: RerankFacts


class RankedJob(BaseModel):
    job: Job
    fit_score: float
    fit_reasons: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    facts: RerankFacts | None = None


class SearchRequest(BaseModel):
    profile: Profile
    jobs: list[Job] | None = None
    limit: int = 50


class SearchResponse(BaseModel):
    results: list[RankedJob] = Field(default_factory=list)
    total_evaluated: int = 0
