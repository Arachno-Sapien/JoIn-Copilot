import pytest

from app.schemas.draft import ClaimWithVerdict
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.services.drafting.rewrite import generate_rewrite_offer


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Alex Smith",
        email="alex@example.com",
        phone="555-0100",
        location="Seattle, WA",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Backend Engineer",
                org="Cloud Systems",
                start="2022-01",
                end="2024-01",
                bullets=[Bullet(id="exp-1-b1", text="Built REST APIs using FastAPI and Python.")],
            )
        ],
        projects=[],
        skills=[Skill(name="Python", level="strong")],
        certifications=[],
        preferences=Preferences(),
    )


@pytest.mark.asyncio
async def test_rewrite_offer_contains_only_supported_or_partly_supported_claims(fake_llm):
    fake_llm.register_handler(
        "rewrite.v1.md",
        lambda inputs: {
            "rewritten_text": "I have 2 years of experience building scalable backend REST APIs using FastAPI and Python.",
        },
    )

    original_draft = (
        "I built scalable REST APIs using FastAPI. Furthermore, I founded a Fortune 500 technology company."
    )

    claims = [
        ClaimWithVerdict(
            claim="I built scalable REST APIs using FastAPI.",
            verdict="supported",
            reason="Supported by exp-1-b1.",
            cited_ids=["exp-1-b1"],
            is_flagged=False,
        ),
        ClaimWithVerdict(
            claim="I founded a Fortune 500 technology company.",
            verdict="unsupported",
            reason="No evidence found in profile.",
            cited_ids=[],
            is_flagged=True,
        ),
    ]

    profile = sample_profile()
    rewrite = await generate_rewrite_offer(original_draft, claims, profile)

    assert "Fortune 500" not in rewrite
    assert "FastAPI" in rewrite
