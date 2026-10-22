import pytest

from app.schemas.draft import ClaimVerdict
from app.schemas.profile import Bullet
from app.services.checker.judge import judge_claim


@pytest.mark.asyncio
async def test_judge_marks_unsupported_even_when_cited(fake_llm):
    fake_llm.register_handler(
        "judge.v1.md",
        lambda inputs: {
            "verdict": "unsupported",
            "reason": "The cited bullet only mentions writing Python scripts, not architecting distributed multi-region databases.",
        },
    )

    claim = "I led the architecture of a global multi-region distributed database serving 100M queries per second."
    evidence_bullets = [Bullet(id="exp-1-b1", text="Wrote automated Python scripts for data cleanup.")]
    cited_ids = ["exp-1-b1"]

    result = await judge_claim(claim=claim, cited_ids=cited_ids, evidence=evidence_bullets)

    assert isinstance(result, ClaimVerdict)
    assert result.verdict == "unsupported"
    assert result.is_flagged is True
    assert "not architecting" in result.reason
