import pytest
from app.schemas.job import Job
from app.services.safety.rules import check_rule_signals


def make_job(**kwargs) -> Job:
    defaults = {
        "id": "job-test",
        "source": "greenhouse",
        "source_id": "src-1",
        "title": "Software Engineer",
        "company": "Tech Corp",
        "location": "Remote",
        "remote": "remote",
        "job_type": "full-time",
        "required_skills": ["Python"],
        "nice_to_have_skills": [],
        "experience_years_min": 2,
        "description": "Standard software engineering responsibilities.",
        "url": "https://techcorp.com/jobs/1",
        "fetched_at": "2026-10-18T10:00:00Z",
    }
    defaults.update(kwargs)
    return Job(**defaults)


def test_rule_signals_fire_on_fee_or_deposit():
    job = make_job(
        description="Candidates must pay a mandatory $250 registration fee and equipment deposit before start."
    )
    signals = check_rule_signals(job)
    assert any("fee" in s.lower() or "deposit" in s.lower() for s in signals)


def test_rule_signals_fire_on_whatsapp_or_personal_email():
    job1 = make_job(
        description="To apply, message our hiring manager on WhatsApp: +1-555-0199 directly."
    )
    signals1 = check_rule_signals(job1)
    assert any("whatsapp" in s.lower() for s in signals1)

    job2 = make_job(
        description="Send your resume to quickhire2026@gmail.com for immediate review."
    )
    signals2 = check_rule_signals(job2)
    assert any("personal email" in s.lower() or "gmail" in s.lower() for s in signals2)


def test_rule_signals_fire_on_outsized_pay():
    job = make_job(
        title="Entry Level Data Entry Clerk",
        description="Simple typing work. We offer compensation of $600 per hour or $25,000 per week for entry level beginners.",
    )
    signals = check_rule_signals(job)
    assert any("pay" in s.lower() or "salary" in s.lower() or "compensation" in s.lower() for s in signals)


def test_rule_signals_fire_on_no_company_website():
    job = make_job(url="")
    signals = check_rule_signals(job)
    assert any("website" in s.lower() or "url" in s.lower() for s in signals)


def test_rule_signals_fire_on_urgency_without_interview():
    job = make_job(
        description="Immediate start without interview required! You are hired right away, start today."
    )
    signals = check_rule_signals(job)
    assert any("interview" in s.lower() or "urgency" in s.lower() for s in signals)


def test_rule_signals_do_not_fire_on_genuine_fixtures():
    genuine_jobs = [
        make_job(
            title="Senior Backend Engineer",
            company="Stripe",
            url="https://stripe.com/jobs/senior-backend",
            description=(
                "We are looking for a Senior Backend Engineer to join our infrastructure team. "
                "You will design scalable APIs, collaborate with cross-functional teams, and participate in our technical interview loop. "
                "Competitive salary ($180,000 - $220,000 per year) and comprehensive benefits."
            ),
        ),
        make_job(
            title="Frontend Developer",
            company="GitHub",
            url="https://github.com/jobs/frontend-dev",
            description=(
                "Join GitHub's web applications team. Requirements include TypeScript, React, and accessibility standards. "
                "Our hiring process involves a recruiter screen followed by a pair programming interview session."
            ),
        ),
    ]

    for job in genuine_jobs:
        signals = check_rule_signals(job)
        assert signals == [], f"Rule signals unexpectedly fired on genuine job: {signals}"
