import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.schemas.search import RerankFacts
from app.services.matching.embeddings import EmbeddingService, cosine_similarity
from app.services.matching.filters import (
    calculate_profile_experience_years,
    hard_filter_jobs,
)
from app.services.matching.recall import embedding_recall
from app.services.matching.scoring import compute_fit_score


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Sam Dev",
        email="sam@example.com",
        phone="5551234",
        location="New York",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Dev",
                org="Org",
                start="2020-01",
                end="2022-01",
                bullets=[Bullet(id="b1", text="Python APIs")],
            )
        ],
        projects=[],
        skills=[Skill(name="Python", level="strong")],
        certifications=[],
        preferences=Preferences(locations=["New York"], remote="any"),
    )


def test_cosine_similarity_edge_cases():
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    assert cosine_similarity(v1, v2) == pytest.approx(1.0)

    v_zero = [0.0, 0.0, 0.0]
    assert cosine_similarity(v1, v_zero) == 0.0

    v_orth = [0.0, 1.0, 0.0]
    assert cosine_similarity(v1, v_orth) == pytest.approx(0.0)


def test_embedding_service_deterministic():
    service = EmbeddingService()
    emb1 = service.embed_text("FastAPI backend developer")
    emb2 = service.embed_text("FastAPI backend developer")
    assert emb1 == emb2

    # Batch embedding
    batch = service.embed_batch(["text 1", "text 2"])
    assert len(batch) == 2


def test_embedding_service_model_fallback_on_error(monkeypatch, caplog):
    import logging

    from app.services.matching import embeddings

    monkeypatch.setenv("JC_EMBED_MODE", "model")
    embeddings._warned_models.clear()

    def _failing_loader(model_name: str):
        raise RuntimeError("Model download blocked or unavailable")

    monkeypatch.setattr(embeddings, "load_fastembed_model", _failing_loader)

    with caplog.at_level(logging.WARNING):
        service = EmbeddingService()
        vec = service.embed_text("Python backend engineer")

    assert len(vec) == embeddings.EMBED_DIM
    # Exactly one warning logged naming the model and stating fake embedding in use
    warnings = [r.message for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 1
    assert "fake embedding is in use" in warnings[0]


def test_embedding_recall_calls_embed_batch_once(monkeypatch):
    from unittest.mock import MagicMock

    from app.schemas.job import Job

    prof = sample_profile()
    job1 = Job(
        id="j1",
        source="manual",
        source_id="s1",
        title="Job 1",
        company="Co 1",
        location="Remote",
        remote="remote",
        job_type="full-time",
        required_skills=[],
        nice_to_have_skills=[],
        description="Desc 1",
        url="https://example.com/1",
        fetched_at="2026-10-18T10:00:00Z",
    )
    job2 = Job(
        id="j2",
        source="manual",
        source_id="s2",
        title="Job 2",
        company="Co 2",
        location="Remote",
        remote="remote",
        job_type="full-time",
        required_skills=[],
        nice_to_have_skills=[],
        description="Desc 2",
        url="https://example.com/2",
        fetched_at="2026-10-18T10:00:00Z",
    )

    mock_service = MagicMock(spec=EmbeddingService)
    mock_service.embed_text.return_value = [1.0] + [0.0] * 383
    mock_service.embed_batch.return_value = [[1.0] + [0.0] * 383, [0.5] + [0.0] * 383]

    matches = embedding_recall(prof, [job1, job2], service=mock_service)
    assert len(matches) == 2
    mock_service.embed_batch.assert_called_once()


def test_experience_calculation_variations():
    prof = sample_profile()
    years = calculate_profile_experience_years(prof)
    assert years == 2.0


def test_hard_filter_empty_list():
    prof = sample_profile()
    assert hard_filter_jobs([], prof) == []


def test_avoid_keywords_word_boundaries():
    from app.schemas.job import Job

    prof = sample_profile()
    prof.preferences.avoid_keywords = ["intern", "c++"]

    job_intl = Job(
        id="j1",
        source="manual",
        source_id="s1",
        title="International Specialist",
        company="Global Corp",
        location="New York",
        remote="onsite",
        job_type="full-time",
        required_skills=[],
        nice_to_have_skills=[],
        experience_years_min=0,
        description="Working on international expansion",
        url="https://example.com/j1",
        fetched_at="2026-10-18T10:00:00Z",
    )
    job_intern = Job(
        id="j2",
        source="manual",
        source_id="s2",
        title="Software Intern",
        company="Tech Corp",
        location="New York",
        remote="onsite",
        job_type="internship",
        required_skills=[],
        nice_to_have_skills=[],
        experience_years_min=0,
        description="Intern role",
        url="https://example.com/j2",
        fetched_at="2026-10-18T10:00:00Z",
    )
    job_cpp = Job(
        id="j3",
        source="manual",
        source_id="s3",
        title="Developer",
        company="Systems Inc",
        location="New York",
        remote="onsite",
        job_type="full-time",
        required_skills=[],
        nice_to_have_skills=[],
        experience_years_min=0,
        description="Must know c++ and algorithms",
        url="https://example.com/j3",
        fetched_at="2026-10-18T10:00:00Z",
    )

    filtered = hard_filter_jobs([job_intl, job_intern, job_cpp], prof)
    # job_intl should remain because "intern" should not match "international"
    # job_intern should be removed by word-boundary "intern"
    # job_cpp should be removed by substring "c++"
    assert [j.id for j in filtered] == ["j1"]


def test_embedding_recall_empty_list():
    prof = sample_profile()
    assert embedding_recall(prof, []) == []


def test_compute_fit_score_boundaries():
    # 0 required skills specified, no gap -> full base + baseline = 85.0
    facts_no_req = RerankFacts(
        matched_required=[],
        missing_required=[],
        matched_nice_to_have=["Docker"],
        experience_gap="",
        summary="No required skills",
    )
    score = compute_fit_score(facts_no_req)
    assert 0.0 <= score <= 100.0


@pytest.mark.asyncio
async def test_search_jobs_empty_pool():
    prof = sample_profile()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/jobs/search",
            json={"profile": prof.model_dump(), "jobs": []},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["results"] == []
        assert data["total_evaluated"] == 0
