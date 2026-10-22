import pytest
from app.schemas.email import CandidateApplication, EmailClassifyResponse, EmailInput
from app.services.classifier.service import classify_email


@pytest.mark.asyncio
async def test_classifier_service_matches_candidate(fake_llm):
    fake_llm.register_handler(
        "classify_email.v1.md",
        lambda inputs: {
            "matched_application_id": "app-test-99",
            "classification": "offer",
            "confidence": 0.99,
            "reasoning": "Official offer letter enclosed.",
        },
    )

    email = EmailInput(
        sender="hr@techcorp.com",
        subject="Offer Letter: Senior Engineer",
        date="2026-10-18T12:00:00Z",
        body="Congratulations, we are pleased to offer you the position.",
    )
    candidates = [
        CandidateApplication(id="app-test-99", company="TechCorp", role="Senior Engineer"),
        CandidateApplication(id="app-test-100", company="OtherCorp", role="Junior Engineer"),
    ]

    result = await classify_email(email, candidates)
    assert isinstance(result, EmailClassifyResponse)
    assert result.matched_application_id == "app-test-99"
    assert result.classification == "offer"
    assert result.confidence == 0.99


@pytest.mark.asyncio
async def test_classifier_service_handles_unmatched_email(fake_llm):
    fake_llm.register_handler(
        "classify_email.v1.md",
        lambda inputs: {
            "matched_application_id": None,
            "classification": "other",
            "confidence": 0.50,
            "reasoning": "Newsletter or unrelated email.",
        },
    )

    email = EmailInput(
        sender="news@random.com",
        subject="Weekly Newsletter",
        date="2026-10-18T12:00:00Z",
        body="Here are top stories this week.",
    )
    candidates = [
        CandidateApplication(id="app-1", company="TechCorp", role="Senior Engineer"),
    ]

    result = await classify_email(email, candidates)
    assert result.matched_application_id is None
    assert result.classification == "other"
    assert result.confidence == 0.50
