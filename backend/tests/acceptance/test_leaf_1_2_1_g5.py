import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill


def make_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Alex Doe",
        email="alex@example.com",
        phone="1234567890",
        location="Bangalore, India",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Software Engineer",
                org="Acme Corp",
                start="2022-01",
                end="2024-01",
                bullets=[Bullet(id="b1", text="Built web APIs using Python and FastAPI.")],
            )
        ],
        projects=[],
        skills=[
            Skill(name="Python", level="strong"),
            Skill(name="FastAPI", level="strong"),
            Skill(name="SQL", level="working"),
        ],
        certifications=[],
        preferences=Preferences(locations=["Bangalore"], remote="any"),
    )


def make_sample_jobs() -> list[dict]:
    return [
        {
            "id": "job-1",
            "source": "manual",
            "source_id": "1",
            "url": "https://example.com/jobs/1",
            "title": "Senior Python Backend Engineer",
            "company": "Alpha Tech",
            "location": "Bangalore",
            "remote": "hybrid",
            "job_type": "full-time",
            "required_skills": ["Python", "FastAPI", "SQL"],
            "nice_to_have_skills": ["Redis"],
            "experience_years_min": 2.0,
            "description": "Looking for Python and FastAPI engineer in Bangalore.",
            "fetched_at": "2026-10-18T12:00:00Z",
        },
        {
            "id": "job-2",
            "source": "manual",
            "source_id": "2",
            "url": "https://example.com/jobs/2",
            "title": "Rust Systems Engineer",
            "company": "Beta Systems",
            "location": "Bangalore",
            "remote": "hybrid",
            "job_type": "full-time",
            "required_skills": ["Rust", "C++"],
            "nice_to_have_skills": ["Linux"],
            "experience_years_min": 2.0,
            "description": "Looking for low-level Rust and C++ systems engineer.",
            "fetched_at": "2026-10-18T12:00:00Z",
        },
    ]


@pytest.mark.asyncio
async def test_search_jobs_endpoint(fake_llm):
    def mock_rerank_handler(inputs):
        job_title = inputs.get("job_title", "")
        if "Python" in job_title:
            return {
                "matched_required": ["Python", "FastAPI", "SQL"],
                "missing_required": [],
                "matched_nice_to_have": ["Redis"],
                "experience_gap": "",
                "summary": "Excellent skill match for Python and FastAPI.",
            }
        else:
            return {
                "matched_required": [],
                "missing_required": ["Rust", "C++"],
                "matched_nice_to_have": [],
                "experience_gap": "",
                "summary": "Candidate lacks required Rust and C++ experience.",
            }

    fake_llm.register_handler("rerank.v1.md", mock_rerank_handler)

    profile = make_profile()
    jobs = make_sample_jobs()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/jobs/search",
            json={"profile": profile.model_dump(), "jobs": jobs},
        )

        assert response.status_code == 200, f"Error: {response.text}"
        data = response.json()

        assert "results" in data
        results = data["results"]
        assert len(results) == 2

        # Sorted by fit score descending
        assert results[0]["fit_score"] >= results[1]["fit_score"]

        top_result = results[0]
        assert top_result["job"]["id"] == "job-1"
        assert top_result["fit_score"] > 80.0
        assert isinstance(top_result["fit_reasons"], list)
        assert len(top_result["fit_reasons"]) > 0
        assert isinstance(top_result["missing_skills"], list)
        assert len(top_result["missing_skills"]) == 0

        second_result = results[1]
        assert second_result["job"]["id"] == "job-2"
        assert len(second_result["missing_skills"]) > 0
        assert "Rust" in second_result["missing_skills"]
