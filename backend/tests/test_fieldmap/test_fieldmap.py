import pytest

from app.schemas.fill import FormFieldInput
from app.schemas.profile import Preferences, Profile
from app.services.fieldmap.mapper import map_form_fields


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Morgan River",
        email="morgan@example.com",
        phone="555-7890",
        location="Portland, OR",
        links={"linkedin": "https://linkedin.com/in/morganriver"},
        education=[],
        experience=[],
        projects=[],
        skills=[],
        certifications=[],
        preferences=Preferences(),
    )


@pytest.mark.asyncio
async def test_empty_fields_returns_empty():
    prof = sample_profile()
    mappings = await map_form_fields(prof, [])
    assert mappings == []


@pytest.mark.asyncio
async def test_email_validation_safety(fake_llm):
    fake_llm.register_handler(
        "map_fields.v1.md",
        lambda inputs: {
            "fields": [
                {
                    "field_id": "f_email",
                    "field_name": "Email",
                    "action": "fill",
                    "profile_path": "email",
                    "value": "fake@malicious.com",
                    "is_open_question": False,
                }
            ]
        },
    )

    prof = sample_profile()
    fields = [FormFieldInput(id="f_email", label="Email", type="email")]
    mappings = await map_form_fields(prof, fields)

    assert len(mappings) == 1
    assert mappings[0].value is None
    assert mappings[0].is_flagged is True
