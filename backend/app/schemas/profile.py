from typing import Literal

from pydantic import BaseModel, Field


class Bullet(BaseModel):
    id: str
    text: str


class Education(BaseModel):
    id: str
    degree: str
    institution: str
    start: str
    end: str
    score: str | None = None


class Experience(BaseModel):
    id: str
    role: str
    org: str
    start: str
    end: str
    bullets: list[Bullet] = Field(default_factory=list)


class Project(BaseModel):
    id: str
    name: str
    bullets: list[Bullet] = Field(default_factory=list)


class Skill(BaseModel):
    name: str
    level: Literal["familiar", "working", "strong"]


class Certification(BaseModel):
    id: str
    name: str
    issuer: str


class Preferences(BaseModel):
    locations: list[str] = Field(default_factory=list)
    remote: Literal["any", "remote", "onsite", "hybrid"] = "any"
    job_types: list[str] = Field(default_factory=list)
    min_stipend: float | int | None = None
    avoid_keywords: list[str] = Field(default_factory=list)


class Profile(BaseModel):
    schema_version: int
    name: str
    email: str
    phone: str
    location: str
    links: dict[str, str] = Field(default_factory=dict)
    education: list[Education] = Field(default_factory=list)
    experience: list[Experience] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    skills: list[Skill] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    preferences: Preferences
