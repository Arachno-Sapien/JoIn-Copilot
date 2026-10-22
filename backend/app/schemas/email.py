from typing import Literal

from pydantic import BaseModel, Field

EmailClassification = Literal[
    "acknowledgement", "assessment", "interview", "rejection", "offer", "other"
]


class CandidateApplication(BaseModel):
    id: str
    company: str
    role: str


class EmailInput(BaseModel):
    sender: str
    subject: str
    date: str
    body: str


class EmailClassifyRequest(BaseModel):
    email: EmailInput
    candidates: list[CandidateApplication] = Field(default_factory=list)


class EmailClassifyResponse(BaseModel):
    matched_application_id: str | None = None
    classification: EmailClassification
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str | None = None
