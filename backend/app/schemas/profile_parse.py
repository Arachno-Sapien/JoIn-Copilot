from pydantic import BaseModel, Field

from app.schemas.profile import Profile


class ProfileParseErrorResponse(BaseModel):
    error: str = Field(description="Error message")
    detail: str | None = Field(default=None, description="Detailed explanation")


__all__ = ["Profile", "ProfileParseErrorResponse"]
