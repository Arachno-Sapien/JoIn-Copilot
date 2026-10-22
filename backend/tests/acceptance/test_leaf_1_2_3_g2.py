import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.profile import Preferences, Profile


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Sam Security",
        email="sam.security@example.com",
        phone="+1-555-999-0000",
        location="San Francisco, CA",
        links={
            "linkedin": "https://linkedin.com/in/samsecurity",
            "github": "https://github.com/samsecurity",
        },
        education=[],
        experience=[],
        projects=[],
        skills=[],
        certifications=[],
        preferences=Preferences(),
    )


@pytest.mark.asyncio
async def test_email_and_url_field_safety_enforcement(fake_llm):
    # Model attempts to map foreign / rogue values
    fake_llm.register_handler(
        "map_fields.v1.md",
        lambda inputs: {
            "fields": [
                {
                    "field_id": "f_email_rogue",
                    "field_name": "Applicant Email",
                    "action": "fill",
                    "profile_path": "email",
                    "value": "attacker@evil.com",  # Rogue email not matching profile
                    "is_open_question": False,
                },
                {
                    "field_id": "f_url_rogue",
                    "field_name": "Portfolio Link",
                    "action": "fill",
                    "profile_path": "links.portfolio",
                    "value": "https://evil-phishing.com/exploit",  # Rogue URL not in profile links
                    "is_open_question": False,
                },
                {
                    "field_id": "f_url_legit",
                    "field_name": "LinkedIn Profile",
                    "action": "fill",
                    "profile_path": "links.linkedin",
                    "value": "https://linkedin.com/in/samsecurity",  # Legit URL from profile
                    "is_open_question": False,
                },
            ]
        },
    )

    profile = sample_profile()
    payload = {
        "profile": profile.model_dump(),
        "fields": [
            {"id": "f_email_rogue", "label": "Applicant Email", "type": "email"},
            {"id": "f_url_rogue", "label": "Portfolio Link", "type": "url"},
            {"id": "f_url_legit", "label": "LinkedIn Profile", "type": "url"},
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/fill/map-fields", json=payload)
        assert response.status_code == 200, f"Error: {response.text}"
        data = response.json()

        mappings = data["mappings"]

        # Rogue email must have its value dropped and be flagged
        email_map = next(m for m in mappings if m["field_id"] == "f_email_rogue")
        assert email_map["value"] is None or email_map["value"] != "attacker@evil.com"
        assert email_map.get("is_flagged") is True

        # Rogue URL must have its value dropped and be flagged
        rogue_url_map = next(m for m in mappings if m["field_id"] == "f_url_rogue")
        assert rogue_url_map["value"] is None or rogue_url_map["value"] != "https://evil-phishing.com/exploit"
        assert rogue_url_map.get("is_flagged") is True

        # Legit URL must pass unflagged
        legit_url_map = next(m for m in mappings if m["field_id"] == "f_url_legit")
        assert legit_url_map["value"] == "https://linkedin.com/in/samsecurity"
        assert legit_url_map.get("is_flagged", False) is False
