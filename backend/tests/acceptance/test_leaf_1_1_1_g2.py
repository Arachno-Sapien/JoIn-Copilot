import copy

import pytest
from pydantic import ValidationError

from app.schemas.application import Application
from app.schemas.job import Job
from app.schemas.profile import Profile

# Synthetic records shaped like the design section 5 samples.
PROFILE = {
    "schema_version": 1,
    "name": "Alex Doe",
    "email": "alex@example.com",
    "phone": "+1234567890",
    "location": "Bangalore, India",
    "links": {
        "linkedin": "https://linkedin.com/in/alexdoe",
        "github": "https://github.com/alexdoe",
        "portfolio": "https://alexdoe.dev",
    },
    "education": [
        {
            "id": "edu-1",
            "degree": "B.Tech Computer Science",
            "institution": "Tech Institute",
            "start": "2020-08",
            "end": "2024-05",
            "score": "8.8 CGPA",
        }
    ],
    "experience": [
        {
            "id": "exp-1",
            "role": "Software Engineer Intern",
            "org": "Acme Corp",
            "start": "2023-06",
            "end": "present",
            "bullets": [{"id": "exp-1-b1", "text": "Built REST APIs with FastAPI"}],
        }
    ],
    "projects": [
        {
            "id": "proj-1",
            "name": "Job Copilot",
            "bullets": [{"id": "proj-1-b1", "text": "Automated application tracking"}],
        }
    ],
    "skills": [{"name": "Python", "level": "strong"}, {"name": "Docker", "level": "familiar"}],
    "certifications": [{"id": "cert-1", "name": "AWS Cloud Practitioner", "issuer": "Amazon"}],
    "preferences": {
        "locations": ["Bangalore", "Remote"],
        "remote": "hybrid",
        "job_types": ["full-time", "internship"],
        "min_stipend": 25000,
        "avoid_keywords": ["gambling"],
    },
}

JOB = {
    "id": "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c",
    "source": "greenhouse",
    "source_id": "gh-9988",
    "url": "https://boards.greenhouse.io/acme/jobs/9988",
    "title": "Backend Developer",
    "company": "Acme",
    "location": "Bangalore",
    "remote": "hybrid",
    "job_type": "full-time",
    "required_skills": ["Python", "FastAPI"],
    "nice_to_have_skills": ["Docker"],
    "experience_years_min": 1,
    "description": "We are seeking a Backend Developer.",
    "posted_at": "2026-10-01",
    "deadline": None,
    "fetched_at": "2026-10-18T10:00:00Z",
}

APPLICATION = {
    "schema_version": 1,
    "id": "6f0c1a52-3b1e-4f61-9c55-2f1d8a7e9b10",
    "job_id": JOB["id"],
    "job_snapshot": {
        "title": "Backend Developer",
        "company": "Acme",
        "url": "https://boards.greenhouse.io/acme/jobs/9988",
        "source": "greenhouse",
    },
    "applied_at": "2026-10-18T10:30:00Z",
    "fit_score": 85,
    "missing_skills": ["Docker"],
    "resume_version": "v1",
    "answers": [{"question": "Why Acme?", "answer": "Great culture.", "flags": []}],
    "status": "applied",
    "status_history": [{"status": "applied", "at": "2026-10-18T10:30:00Z", "source": "user"}],
    "notes": "",
}

DESIGN_STATUSES = [
    "applied", "viewed", "assessment", "interview", "offer", "rejected", "no_response", "withdrawn",
]


def test_design_shaped_samples_are_accepted():
    assert Profile.model_validate(PROFILE).experience[0].bullets[0].id == "exp-1-b1"
    assert Job.model_validate(JOB).source == "greenhouse"
    assert Application.model_validate(APPLICATION).status == "applied"


@pytest.mark.parametrize("status", DESIGN_STATUSES)
def test_every_design_status_is_accepted_in_status_and_history(status):
    record = copy.deepcopy(APPLICATION)
    record["status"] = status
    record["status_history"].append({"status": status, "at": "2026-10-19T09:00:00Z", "source": "gmail"})
    assert Application.model_validate(record).status_history[-1].status == status


def _drop_schema_version(r):
    del r["schema_version"]


def _drop_bullet_id(r):
    del r["experience"][0]["bullets"][0]["id"]


def _set(path, value):
    def mutate(r):
        target = r
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value
    return mutate


INVALID = [
    ("profile missing schema_version", Profile, PROFILE, _drop_schema_version),
    ("bullet without id", Profile, PROFILE, _drop_bullet_id),
    ("skill level outside familiar/working/strong", Profile, PROFILE, _set(["skills", 0, "level"], "expert")),
    ("unknown remote preference", Profile, PROFILE, _set(["preferences", "remote"], "sometimes")),
    ("unknown job source", Job, JOB, _set(["source"], "linkedin")),
    ("unknown job remote value", Job, JOB, _set(["remote"], "maybe")),
    ("unknown application status", Application, APPLICATION, _set(["status"], "unknown_random_status")),
    ("unknown status in history", Application, APPLICATION, _set(["status_history", 0, "status"], "banana")),
    ("unknown history source", Application, APPLICATION, _set(["status_history", 0, "source"], "robot")),
]


@pytest.mark.parametrize(("case", "model", "base", "mutate"), INVALID, ids=[c[0] for c in INVALID])
def test_invalid_records_are_rejected(case, model, base, mutate):
    record = copy.deepcopy(base)
    mutate(record)
    with pytest.raises(ValidationError):
        model.model_validate(record)
