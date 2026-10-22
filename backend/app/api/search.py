from fastapi import APIRouter

from app.schemas.search import RankedJob, SearchRequest, SearchResponse
from app.services.jobs.cache import JobCache
from app.services.matching.filters import hard_filter_jobs
from app.services.matching.recall import embedding_recall
from app.services.matching.rerank import rerank_candidates
from app.services.matching.scoring import compute_fit_score

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/search", response_model=SearchResponse)
async def search_jobs(request: SearchRequest) -> SearchResponse:
    # 1. Obtain jobs pool
    if request.jobs is not None:
        raw_jobs = request.jobs
    else:
        cache = JobCache()
        raw_jobs = cache.list_jobs(limit=1000)

    if not raw_jobs:
        return SearchResponse(results=[], total_evaluated=0)

    # 2. Stage 1: Hard filtering (no model)
    filtered = hard_filter_jobs(raw_jobs, request.profile)
    if not filtered:
        return SearchResponse(results=[], total_evaluated=len(raw_jobs))

    # 3. Stage 2: Embedding recall (capped at limit or 50)
    recall_limit = min(request.limit, 50) if request.limit else 50
    recalled = embedding_recall(request.profile, filtered, limit=recall_limit)

    # 4. Stage 3: LLM reranking (structured facts)
    reranked = await rerank_candidates(request.profile, recalled)

    # 5. Stage 4: Code-computed fit score and ranking
    ranked_jobs: list[RankedJob] = []
    for item in reranked:
        score = compute_fit_score(item.facts)
        reasons: list[str] = []
        if item.facts.matched_required:
            reasons.append("Matched required skills: " + ", ".join(item.facts.matched_required))
        if item.facts.matched_nice_to_have:
            reasons.append("Bonus skills: " + ", ".join(item.facts.matched_nice_to_have))
        if item.facts.summary:
            reasons.append(item.facts.summary)
        elif not item.facts.experience_gap:
            reasons.append("Meets experience requirements")

        ranked_jobs.append(
            RankedJob(
                job=item.job,
                fit_score=score,
                fit_reasons=reasons,
                missing_skills=item.facts.missing_required,
                facts=item.facts,
            )
        )

    # Sort descending by fit_score
    ranked_jobs.sort(key=lambda r: r.fit_score, reverse=True)

    return SearchResponse(results=ranked_jobs, total_evaluated=len(raw_jobs))
