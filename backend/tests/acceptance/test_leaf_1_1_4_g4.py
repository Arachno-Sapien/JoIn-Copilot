import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.profile import Profile


def make_sample_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 72), "Alex Doe\nSoftware Engineer\nPython Developer")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


VALID_PROFILE_DICT = {
    "schema_version": 1,
    "name": "Alex Doe",
    "email": "alex@example.com",
    "phone": "+1234567890",
    "location": "Remote",
    "links": {},
    "education": [],
    "experience": [],
    "projects": [],
    "skills": [{"name": "Python", "level": "strong"}],
    "certifications": [],
    "preferences": {
        "locations": ["Remote"],
        "remote": "remote",
        "job_types": ["full-time"],
    },
}


@pytest.mark.asyncio
async def test_parse_retry_succeeds_on_second_attempt(fake_llm):
    # First attempt: invalid output (missing required fields)
    # Second attempt (retry): valid output
    attempt = 0

    def mock_parser_handler(inputs):
        nonlocal attempt
        attempt += 1
        if attempt == 1:
            return {"invalid_key": "not a valid profile"}
        return VALID_PROFILE_DICT

    fake_llm.register_handler("parse_resume.v1.md", mock_parser_handler)
    fake_llm.register_handler("parse_resume_retry.v1.md", mock_parser_handler)

    pdf_bytes = make_sample_pdf()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/profile/parse",
            files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
        )

        assert response.status_code == 200, f"Expected 200 on retry success, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "Alex Doe"
        Profile.model_validate(data)
        assert attempt == 2


@pytest.mark.asyncio
async def test_parse_retry_failure_returns_422(fake_llm):
    # Both initial and retry fail schema validation
    fake_llm.register_handler(
        "parse_resume.v1.md",
        lambda inputs: {"invalid_key": "not a valid profile"},
    )
    fake_llm.register_handler(
        "parse_resume_retry.v1.md",
        lambda inputs: {"still_invalid": "second failure"},
    )

    pdf_bytes = make_sample_pdf()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/profile/parse",
            files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
        )

        assert response.status_code == 422, f"Expected 422 on second failure, got {response.status_code}"
        data = response.json()
        assert "error" in data or "detail" in data
