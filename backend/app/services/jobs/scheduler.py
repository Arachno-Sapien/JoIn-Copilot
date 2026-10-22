import logging
import os
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings

logger = logging.getLogger(__name__)


def refresh_jobs_daily() -> None:
    logger.info("Executing scheduled daily job refresh...")
    # Background sync task will fetch configured boards and update cache


class JobSchedulerService:
    def __init__(self) -> None:
        self.scheduler: BackgroundScheduler | None = None

    def is_enabled(self) -> bool:
        env_val = os.environ.get("JC_SCHEDULER")
        if env_val is not None:
            return env_val.strip().lower() == "on"
        return settings.JC_SCHEDULER.strip().lower() == "on"

    def start(self) -> None:
        if not self.is_enabled():
            logger.info("JC_SCHEDULER is off; no background scheduler started.")
            return

        if self.scheduler is None:
            self.scheduler = BackgroundScheduler()
            self.scheduler.add_job(
                refresh_jobs_daily,
                trigger="interval",
                days=1,
                id="daily_job_refresh",
                name="Daily Job Refresh",
                replace_existing=True,
            )
            self.scheduler.start()
            logger.info("APScheduler started with daily_job_refresh.")

    def stop(self) -> None:
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            self.scheduler = None

    def get_scheduled_jobs(self) -> list[Any]:
        if not self.scheduler:
            return []
        return self.scheduler.get_jobs()


_scheduler_instance: JobSchedulerService | None = None


def get_job_scheduler() -> JobSchedulerService:
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = JobSchedulerService()
    return _scheduler_instance
