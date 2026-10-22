from typing import Literal, Optional
from pydantic import BaseModel, Field

ScamRiskLevel = Literal["low", "medium", "high"]


class ScamCheckRequest(BaseModel):
    pass


class ScamModelOutput(BaseModel):
    risk_level: ScamRiskLevel
    flags: list[str] = Field(default_factory=list)
    reasoning: Optional[str] = None


class ScamCheckResponse(BaseModel):
    job_id: str
    risk_level: ScamRiskLevel
    reasons: list[str] = Field(default_factory=list)
    rule_signals: list[str] = Field(default_factory=list)
    llm_flags: list[str] = Field(default_factory=list)
    injection_warning: Optional[str] = None
