import pytest

from app.llm.provider import BusyError, NotConfiguredError, TruncatedError
from app.services.parser import pipeline


@pytest.mark.parametrize(
    "error",
    [BusyError("req-1"), TruncatedError('{"name": "half', "req-2"), NotConfiguredError()],
    ids=["busy", "truncated", "no provider"],
)
async def test_provider_failures_are_reported_not_retried(monkeypatch, error):
    calls = []

    async def failing_acomplete(**kwargs):
        calls.append(kwargs["template"])
        raise error

    monkeypatch.setattr(pipeline, "extract_text_from_pdf", lambda _bytes: "Resume text")
    monkeypatch.setattr(pipeline, "acomplete", failing_acomplete)

    with pytest.raises(type(error)):
        await pipeline.parse_resume_pipeline(b"%PDF")
    assert calls == ["parse_resume.v1.md"]
