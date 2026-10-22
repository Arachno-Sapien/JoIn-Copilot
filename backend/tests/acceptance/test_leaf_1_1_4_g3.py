import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.profile import Profile


def make_sample_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(
        (50, 72),
        "Alex Doe\nalex@example.com\nBangalore, India\n\nExperience:\nSoftware Engineer at Acme Corp",
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.mark.asyncio
async def test_parse_profile_endpoint_returns_valid_profile(fake_llm):
    fake_llm.register_handler(
        "parse_resume.v1.md",
        lambda inputs: {
            "schema_version": 1,
            "name": "Alex Doe",
            "email": "alex@example.com",
            "phone": "+91-9876543210",
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
                    "institution": "National Institute of Tech",
                    "start": "2020-08",
                    "end": "2024-05",
                    "score": "8.5 CGPA",
                }
            ],
            "experience": [
                {
                    "id": "exp-1",
                    "role": "Software Engineer",
                    "org": "Acme Corp",
                    "start": "2024-06",
                    "end": "present",
                    "bullets": [
                        {"id": "", "text": "Developed REST APIs using FastAPI and Python."},
                        {"id": "", "text": "Implemented caching to reduce API response times."},
                    ],
                }
            ],
            "projects": [
                {
                    "id": "proj-1",
                    "name": "Job Copilot",
                    "bullets": [
                        {"id": "", "text": "Built local-first Chrome extension with React."}
                    ],
                }
            ],
            "skills": [
                {"name": "Python", "level": "strong"},
                {"name": "FastAPI", "level": "strong"},
                {"name": "Docker", "level": "familiar"},
            ],
            "certifications": [
                {"id": "cert-1", "name": "AWS Solutions Architect", "issuer": "Amazon"}
            ],
            "preferences": {
                "locations": ["Bangalore", "Remote"],
                "remote": "hybrid",
                "job_types": ["full-time"],
                "min_stipend": 50000,
                "avoid_keywords": [],
            },
        },
    )

    pdf_bytes = make_sample_pdf()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/profile/parse",
            files={"file": ("alex_doe_resume.pdf", pdf_bytes, "application/pdf")},
        )

        assert response.status_code == 200, f"Error: {response.text}"
        data = response.json()

        assert data["name"] == "Alex Doe"
        assert data["email"] == "alex@example.com"
        assert len(data["experience"]) == 1
        assert len(data["skills"]) == 3

        # Validate with Pydantic model
        profile = Profile.model_validate(data)
        assert profile.name == "Alex Doe"
