import logging

from app.config import settings
from app.schemas.job import Job
from app.services.jobs.adzuna import AdzunaFetcher
from app.services.jobs.cache import JobCache
from app.services.jobs.dedup import deduplicate_jobs
from app.services.jobs.greenhouse import GreenhouseFetcher
from app.services.jobs.lever import LeverFetcher

logger = logging.getLogger(__name__)


async def refresh_jobs(cache: JobCache | None = None) -> int:
    gh_boards = [b.strip() for b in settings.JC_GREENHOUSE_BOARDS.split(",") if b.strip()]
    lever_companies = [c.strip() for c in settings.JC_LEVER_COMPANIES.split(",") if c.strip()]
    adzuna_queries = [q.strip() for q in settings.JC_ADZUNA_QUERIES.split(",") if q.strip()]

    all_jobs: list[Job] = []

    # 1. Greenhouse
    if gh_boards:
        gh_fetcher = GreenhouseFetcher()
        for board in gh_boards:
            try:
                jobs = await gh_fetcher.fetch_board_jobs(board)
                all_jobs.extend(jobs)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error fetching Greenhouse board %s: %s", board, type(exc).__name__)

    # 2. Lever
    if lever_companies:
        lever_fetcher = LeverFetcher()
        for company in lever_companies:
            try:
                jobs = await lever_fetcher.fetch_postings(company)
                all_jobs.extend(jobs)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error fetching Lever company %s: %s", company, type(exc).__name__)

    # 3. Adzuna
    if adzuna_queries and settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY:
        adzuna_fetcher = AdzunaFetcher(
            app_id=settings.ADZUNA_APP_ID,
            app_key=settings.ADZUNA_APP_KEY,
            country=settings.JC_ADZUNA_COUNTRY,
        )
        for query in adzuna_queries:
            try:
                jobs = await adzuna_fetcher.fetch_jobs(what=query)
                all_jobs.extend(jobs)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error fetching Adzuna query %s: %s", query, type(exc).__name__)

    target_cache = cache if cache is not None else JobCache()

    if not all_jobs:
        target_cache.delete_older_than(30)
        return 0

    unique_jobs = deduplicate_jobs(all_jobs)
    target_cache.upsert_jobs(unique_jobs)
    target_cache.delete_older_than(30)
    return len(unique_jobs)
