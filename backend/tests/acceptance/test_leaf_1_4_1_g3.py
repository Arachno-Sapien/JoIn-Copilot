import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_classify_email_picks_matching_application_and_valid_classification(fake_llm):
    fake_llm.register_handler(
        "classify_email.v1.md",
        lambda inputs: {
            "matched_application_id": "app-stripe-1",
            "classification": "interview",
            "confidence": 0.95,
            "reasoning": "Recruiter from Stripe is scheduling a technical interview.",
        },
    )

    payload = {
        "email": {
            "sender": "recruiter@stripe.com",
            "subject": "Interview with Stripe: Software Engineer",
            "date": "2026-10-18T10:00:00Z",
            "body": "Hi Alice, We'd love to invite you to interview for the Software Engineer role.",
        },
        "candidates": [
            {"id": "app-google-1", "company": "Google", "role": "Software Engineer"},
            {"id": "app-stripe-1", "company": "Stripe", "role": "Software Engineer"},
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/email/classify", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["matched_application_id"] == "app-stripe-1"
    assert data["classification"] == "interview"
    assert 0.0 <= data["confidence"] <= 1.0
    assert data["confidence"] >= 0.9
    assert data["reasoning"] is not None


@pytest.mark.asyncio
async def test_classify_email_handles_all_supported_classifications(fake_llm):
    classifications = ["acknowledgement", "assessment", "interview", "rejection", "offer", "other"]

    for cls in classifications:
        fake_llm.register_handler(
            "classify_email.v1.md",
            lambda inputs, c=cls: {
                "matched_application_id": "app-1",
                "classification": c,
                "confidence": 0.88,
                "reasoning": f"Identified as {c}",
            },
        )

        payload = {
            "email": {
                "sender": "jobs@example.com",
                "subject": f"Update on your application: {cls}",
                "date": "2026-10-18T12:00:00Z",
                "body": f"This is an email regarding {cls}.",
            },
            "candidates": [{"id": "app-1", "company": "ExampleCorp", "role": "Engineer"}],
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/email/classify", json=payload)

        assert response.status_code == 200
        assert response.json()["classification"] == cls
