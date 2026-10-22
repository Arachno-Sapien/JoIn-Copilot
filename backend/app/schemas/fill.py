from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.profile import Profile


class FormFieldInput(BaseModel):
    id: str
    label: str
    type: str = "text"
    options: list[str] | None = None


class FieldMapping(BaseModel):
    field_id: str
    field_name: str
    action: Literal["fill", "open_question", "skip"] = "fill"
    profile_path: str | None = None
    value: str | None = None
    is_open_question: bool = False
    is_flagged: bool = False
    flag_reason: str | None = None


class MapFieldsModelOutput(BaseModel):
    fields: list[FieldMapping] = Field(default_factory=list)


class MapFieldsRequest(BaseModel):
    profile: Profile
    fields: list[FormFieldInput] = Field(default_factory=list)


class MapFieldsResponse(BaseModel):
    mappings: list[FieldMapping] = Field(default_factory=list)
