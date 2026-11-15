import httpx
import respx
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import create_app
from app.schemas.email import CandidateApplication, EmailInput
from app.services.classifier.service import classify_email

BASE_URL = "https://llm.example.test/v1"
HEADERS = {"X-LLM-Base-URL": BASE_URL, "X-LLM-Model": "example-model", "X-LLM-Key": "test-key-not-real"}
JOB = '{"title": "Backend Engineer", "company": "Acme", "description": "Build APIs"}'


def reply(text):
    return {"choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}]}


async def extract(monkeypatch, model_text):
    monkeypatch.setenv("JC_LLM_MODE", "live")
    monkeypatch.setattr(settings, "JC_LLM_MODE", "live")
    respx.post(f"{BASE_URL}/chat/completions").mock(return_value=httpx.Response(200, json=reply(model_text)))
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
        return await client.post(
            "/jobs/extract", json={"text": "page text", "url": "https://jobs.example.test/1"}, headers=HEADERS
        )


@respx.mock
async def test_a_model_answer_in_the_wrong_format_is_explained_not_a_500(monkeypatch):
    response = await extract(monkeypatch, "Sure! The job is a Backend Engineer role.")
    assert response.status_code == 502
    assert "format" in response.json()["error"]
    assert "Backend Engineer" not in response.text  # never echo the model's text


@respx.mock
async def test_json_inside_a_markdown_code_fence_is_accepted(monkeypatch):
    response = await extract(monkeypatch, f"```json\n{JOB}\n```")
    assert response.status_code == 200
    assert response.json()["title"] == "Backend Engineer"


async def test_a_file_that_is_not_a_pdf_is_rejected_with_422():
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
        response = await client.post(
            "/profile/parse", files={"file": ("cv.pdf", b"this is not a pdf", "application/pdf")}
        )
    assert response.status_code == 422


async def test_an_application_without_a_company_never_matches_by_name(fake_llm):
    fake_llm.register_handler(
        "classify_email.v1.md",
        lambda _inputs: {"matched_application_id": "not-a-candidate", "classification": "rejection", "confidence": 0.9},
    )
    result = await classify_email(
        EmailInput(sender="hr@other.example.test", subject="Update", date="2026-01-01", body="We regret"),
        [CandidateApplication(id="a1", company="", role="Engineer")],
    )
    assert result.matched_application_id is None
