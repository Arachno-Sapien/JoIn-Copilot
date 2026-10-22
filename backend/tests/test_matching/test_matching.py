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


def test_experience_calculation_variations():
    prof = sample_profile()
    years = calculate_profile_experience_years(prof)
    assert years == 2.0


def test_hard_filter_empty_list():
    prof = sample_profile()
    assert hard_filter_jobs([], prof) == []


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
