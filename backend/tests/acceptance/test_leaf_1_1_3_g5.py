from app.services.jobs.scheduler import JobSchedulerService


def test_scheduler_on_registers_daily_refresh(monkeypatch):
    monkeypatch.setenv("JC_SCHEDULER", "on")
    service = JobSchedulerService()
    try:
        service.start()
        jobs = service.get_scheduled_jobs()
        assert len(jobs) >= 1
        daily_job = next((j for j in jobs if "daily" in j.id.lower() or "refresh" in j.id.lower()), None)
        assert daily_job is not None
    finally:
        service.stop()


def test_scheduler_off_registers_no_jobs(monkeypatch):
    monkeypatch.setenv("JC_SCHEDULER", "off")
    service = JobSchedulerService()
    try:
        service.start()
        jobs = service.get_scheduled_jobs()
        assert len(jobs) == 0
    finally:
        service.stop()
