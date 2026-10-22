import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Alex Smith",
        email="alex@example.com",
        phone="+1-555-123-4567",
        location="Seattle, WA",
        links={
            "linkedin": "https://linkedin.com/in/alexsmith",
            "github": "https://github.com/alexsmith",
        },
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Software Engineer",
                org="Tech Innovators",
                start="2022-01",
                end="2024-01",
                bullets=[Bullet(id="b1", text="Built APIs using Python.")],
            )
        ],
        projects=[],
        skills=[Skill(name="Python", level="strong")],
        certifications=[],
        preferences=Preferences(),
    )


@pytest.mark.asyncio
async def test_map_fields_endpoint_returns_mapped_or_open_question(fake_llm):
    fake_llm.register_handler(
        "map_fields.v1.md",
        lambda inputs: {
            "fields": [
                {
                    "field_id": "f_name",
                    "field_name": "Full Name",
                    "action": "fill",
                    "profile_path": "name",
                    "value": "Alex Smith",
                    "is_open_question": False,
                },
                {
                    "field_id": "f_email",
                    "field_name": "Email Address",
                    "action": "fill",
                    "profile_path": "email",
                    "value": "alex@example.com",
                    "is_open_question": False,
                },
                {
                    "field_id": "f_why",
                    "field_name": "Why do you want to join our engineering team?",
                    "action": "open_question",
                    "profile_path": None,
                    "value": None,
                    "is_open_question": True,
                },
            ]
        },
    )

    profile = sample_profile()
    payload = {
        "profile": profile.model_dump(),
        "fields": [
            {"id": "f_name", "label": "Full Name", "type": "text"},
            {"id": "f_email", "label": "Email Address", "type": "email"},
            {"id": "f_why", "label": "Why do you want to join our engineering team?", "type": "textarea"},
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/fill/map-fields", json=payload)
        assert response.status_code == 200, f"Error: {response.text}"
        data = response.json()

        assert "mappings" in data
        mappings = data["mappings"]
        assert len(mappings) == 3

        # Standard name field
        name_map = next(m for m in mappings if m["field_id"] == "f_name")
        assert name_map["action"] == "fill"
        assert name_map["value"] == "Alex Smith"
        assert name_map["profile_path"] == "name"
        assert name_map["is_open_question"] is False

        # Email field
        email_map = next(m for m in mappings if m["field_id"] == "f_email")
        assert email_map["action"] == "fill"
        assert email_map["value"] == "alex@example.com"
        assert email_map["profile_path"] == "email"

        # Free text open question
        why_map = next(m for m in mappings if m["field_id"] == "f_why")
        assert why_map["action"] == "open_question"
        assert why_map["is_open_question"] is True
