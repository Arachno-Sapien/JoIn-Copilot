import hashlib

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.job import Job


@pytest.mark.asyncio
async def test_extract_job_from_page_text(fake_llm):
    # Register mock response for extract_job.v1.md
    fake_llm.register_handler(
        "extract_job.v1.md",
        lambda inputs: {
            "title": "Machine Learning Engineer",
            "company": "DeepMind",
            "location": "London, UK",
            "remote": "hybrid",
            "job_type": "full-time",
            "required_skills": ["Python", "PyTorch"],
            "nice_to_have_skills": ["JAX"],
            "experience_years_min": 2,
            "description": "Looking for ML engineer to train foundation models.",
            "posted_at": "2026-10-10",
            "deadline": None,
        },
    )

    url = "https://careers.google.com/jobs/results/12345"
    page_text = "DeepMind is looking for a Machine Learning Engineer in London. Hybrid role. Requirements: Python, PyTorch."

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/jobs/extract",
            json={"text": page_text, "url": url},
        )
        assert response.status_code == 200, f"Error: {response.text}"
        data = response.json()

        assert data["source"] == "manual"
        assert data["title"] == "Machine Learning Engineer"
        assert data["company"] == "DeepMind"
        assert data["location"] == "London, UK"
        assert data["url"] == url
        assert data["remote"] == "hybrid"
        assert data["job_type"] == "full-time"
        assert data["required_skills"] == ["Python", "PyTorch"]
        assert data["fetched_at"] is not None

        # Check id format
        expected_id = hashlib.sha1(f"manual{data['source_id']}".encode()).hexdigest()
        assert data["id"] == expected_id

        # Validate with pydantic
        job = Job.model_validate(data)
        assert job.id == expected_id
