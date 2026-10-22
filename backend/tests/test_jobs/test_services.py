import hashlib

from app.services.jobs.adzuna import _detect_job_type, _detect_remote, map_adzuna_job
from app.services.jobs.cache import JobCache
from app.services.jobs.greenhouse import _clean_html, map_greenhouse_job
from app.services.jobs.lever import map_lever_job


def test_detect_remote():
    assert _detect_remote("Remote Python Dev", "USA", "") == "remote"
    assert _detect_remote("Python Dev", "Bangalore", "Work from home available") == "remote"
    assert _detect_remote("Python Dev", "Bangalore", "Hybrid role (2 days office)") == "hybrid"
    assert _detect_remote("Python Dev", "Bangalore", "Strictly onsite position") == "onsite"
    assert _detect_remote("Python Dev", "Bangalore", "Fast growing team") == "unknown"


def test_detect_job_type():
    assert _detect_job_type("Software Intern", None, "") == "internship"
    assert _detect_job_type("Backend Engineer", "full_time", "") == "full-time"
    assert _detect_job_type("Contractor", "contract", "") == "contract"
    assert _detect_job_type("Developer", None, "No details") == "unknown"


def test_clean_html():
    html = "<div><p>Hello <b>World</b>!</p></div>"
    assert _clean_html(html) == "Hello World !"


def test_adzuna_job_hash_id():
    raw = {
        "id": "12345",
        "title": "Engineer",
        "company": {"display_name": "Test Co"},
        "location": {"display_name": "Delhi"},
        "description": "Dev",
        "redirect_url": "https://example.com/12345",
    }
    job = map_adzuna_job(raw)
    expected = hashlib.sha1(b"adzuna12345").hexdigest()
    assert job.id == expected
    assert job.source == "adzuna"


def test_greenhouse_job_hash_id():
    raw = {
        "id": 999,
        "title": "Engineer",
        "location": {"name": "Remote"},
        "content": "<p>Dev</p>",
        "absolute_url": "https://example.com/gh/999",
    }
    job = map_greenhouse_job("Acme", raw)
    expected = hashlib.sha1(b"greenhouse999").hexdigest()
    assert job.id == expected
    assert job.company == "Acme"


def test_lever_job_hash_id():
    raw = {
        "id": "lev-99",
        "text": "Designer",
        "categories": {"location": "Remote", "commitment": "Full time"},
        "descriptionPlain": "Design UI",
        "hostedUrl": "https://example.com/lev/99",
    }
    job = map_lever_job("Beta", raw)
    expected = hashlib.sha1(b"leverlev-99").hexdigest()
    assert job.id == expected
    assert job.company == "Beta"


def test_cache_empty_upsert(tmp_path):
    db_file = tmp_path / "cache_test.sqlite"
    cache = JobCache(db_path=str(db_file))
    cache.upsert_jobs([])
    assert cache.list_jobs() == []
    assert cache.get_job("non-existent") is None
