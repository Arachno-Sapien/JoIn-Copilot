import pytest
from app.schemas.search import RerankFacts
from app.services.matching.scoring import compute_fit_score


def test_fit_score_deterministic():
    facts = RerankFacts(
        matched_required=["Python", "FastAPI"],
        missing_required=["Kubernetes"],
        matched_nice_to_have=["Redis"],
        experience_gap="Requires 2 years, has 1 year",
        summary="Good match overall",
    )

    first_score = compute_fit_score(facts)
    for _ in range(10):
        assert compute_fit_score(facts) == first_score


def test_fit_score_rises_with_more_matched_required_skills():
    facts_1_match = RerankFacts(
        matched_required=["Python"],
        missing_required=["FastAPI", "SQL", "Docker"],
        matched_nice_to_have=[],
        experience_gap="",
        summary="Only 1 required skill matched",
    )

    facts_3_match = RerankFacts(
        matched_required=["Python", "FastAPI", "SQL"],
        missing_required=["Docker"],
        matched_nice_to_have=[],
        experience_gap="",
        summary="3 required skills matched",
    )

    facts_all_match = RerankFacts(
        matched_required=["Python", "FastAPI", "SQL", "Docker"],
        missing_required=[],
        matched_nice_to_have=["AWS"],
        experience_gap="",
        summary="All required skills matched",
    )

    score_1 = compute_fit_score(facts_1_match)
    score_3 = compute_fit_score(facts_3_match)
    score_all = compute_fit_score(facts_all_match)

    assert score_3 > score_1, f"Expected {score_3} > {score_1}"
    assert score_all > score_3, f"Expected {score_all} > {score_3}"


def test_fit_score_experience_gap_penalty():
    facts_no_gap = RerankFacts(
        matched_required=["Python", "FastAPI"],
        missing_required=[],
        matched_nice_to_have=[],
        experience_gap="",
        summary="Great fit, meets experience requirement",
    )

    facts_with_gap = RerankFacts(
        matched_required=["Python", "FastAPI"],
        missing_required=[],
        matched_nice_to_have=[],
        experience_gap="Requires 5 years; profile shows 1 year",
        summary="Significant experience gap",
    )

    score_no_gap = compute_fit_score(facts_no_gap)
    score_with_gap = compute_fit_score(facts_with_gap)

    assert score_no_gap > score_with_gap, f"Expected penalty for experience gap: {score_no_gap} vs {score_with_gap}"
