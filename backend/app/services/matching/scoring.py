from app.schemas.search import RerankFacts


def compute_fit_score(facts: RerankFacts) -> float:
    """Computes a deterministic fit score (0.0 to 100.0) in code based on rerank facts.

    Formula:
    - Base required skills match: up to 75.0 points
    - Nice-to-have skills bonus: up to 15.0 points (5.0 per skill, capped at 15.0)
    - Baseline alignment: 10.0 points
    - Experience gap penalty: -15.0 points if experience_gap is non-empty
    Clamped to [0.0, 100.0] and rounded to 1 decimal place.
    """
    total_required = len(facts.matched_required) + len(facts.missing_required)
    if total_required > 0:
        required_ratio = len(facts.matched_required) / total_required
    else:
        # If no specific required skills listed, assume full baseline match
        required_ratio = 1.0

    base_score = required_ratio * 75.0
    nice_bonus = min(15.0, len(facts.matched_nice_to_have) * 5.0)
    baseline = 10.0

    gap_penalty = 15.0 if bool(facts.experience_gap and facts.experience_gap.strip()) else 0.0

    raw_score = base_score + nice_bonus + baseline - gap_penalty
    clamped = max(0.0, min(100.0, raw_score))
    return round(clamped, 1)
