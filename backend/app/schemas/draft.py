from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.job import Job
from app.schemas.profile import Profile


class ClaimItem(BaseModel):
    claim_text: str
    cited_bullet_ids: list[str] = Field(default_factory=list)


class ExtractClaimsResponse(BaseModel):
    claims: list[ClaimItem] = Field(default_factory=list)


class ClaimVerdict(BaseModel):
    verdict: Literal["supported", "partly_supported", "unsupported"]
    reason: str
    is_flagged: bool = False


class ClaimWithVerdict(BaseModel):
    claim: str
    verdict: Literal["supported", "partly_supported", "unsupported"]
    reason: str
    cited_ids: list[str] = Field(default_factory=list)
    is_flagged: bool = False


class FlaggedSpan(BaseModel):
    text: str
    start: int | None = None
    end: int | None = None
    reason: str


class DraftRequest(BaseModel):
    job: Job
    question: str
    profile: Profile


class DraftResponse(BaseModel):
    draft: str
    claims: list[ClaimWithVerdict] = Field(default_factory=list)
    flagged_spans: list[FlaggedSpan] = Field(default_factory=list)
    rewrite: str | None = None


class DraftModelOutput(BaseModel):
    draft_text: str


class RewriteModelOutput(BaseModel):
    rewritten_text: str
