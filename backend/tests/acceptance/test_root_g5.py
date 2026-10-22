import io
import sqlite3
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app

CANARY_TOKEN = "CANARY_TOKEN_ALPHA_OMEGA_987654321"
CANARY_EMAIL = "canary_applicant_987654321@canary-vault.example"


@pytest.mark.asyncio
async def test_canary_leaves_no_trace_in_storage_files_or_logs(fake_llm):
    # 1. Register fake LLM handlers for all endpoints
    fake_llm.register_handler(
        "parse_resume.v1.md",
        lambda inputs: {
            "schema_version": 1,
            "name": "Canary Candidate",
            "email": "candidate@example.com",
            "phone": "+1-555-0100",
            "location": "Remote",
            "links": {},
            "skills": [
                {"name": "Python", "level": "strong"},
            ],
            "education": [],
            "experience": [],
            "projects": [],
            "certifications": [],
            "preferences": {
                "locations": ["Remote"],
                "remote": "remote",
                "job_types": ["full-time"],
                "min_stipend": None,
                "avoid_keywords": [],
            },
        },
    )

    fake_llm.register_handler(
        "draft.v1.md",
        lambda inputs: {"draft_text": "I have solid software experience."},
    )
    fake_llm.register_handler(
        "extract_claims.v1.md",
        lambda inputs: {"claims": [{"claim_text": "I have solid software experience.", "cited_bullet_ids": []}]},
    )
    fake_llm.register_handler(
        "judge.v1.md",
        lambda inputs: {"verdict": "supported", "reason": "General statement."},
    )
    fake_llm.register_handler(
        "map_fields.v1.md",
        lambda inputs: {"fields": []},
    )
    fake_llm.register_handler(
        "classify_email.v1.md",
        lambda inputs: {
            "classification": "acknowledgement",
            "confidence": 0.9,
            "reasoning": "Standard received acknowledgment.",
        },
    )

    # 2. Call /profile/parse with canary resume in PDF format
    import fitz
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    pdf_text = f"Canary Resume\nEmail: {CANARY_EMAIL}\nSecret: {CANARY_TOKEN}\nExperience: Python"
    page.insert_text((50, 72), pdf_text, fontsize=11)
    canary_pdf_bytes = doc.tobytes()
    doc.close()

    files = {"file": ("canary_resume.pdf", io.BytesIO(canary_pdf_bytes), "application/pdf")}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/profile/parse", files=files)
        assert res.status_code == 200, f"Parse failed: {res.text}"

    # 3. Call /draft with canary profile
    draft_payload = {
        "job": {
            "id": "job-canary-1",
            "source": "manual",
            "source_id": "s-canary",
            "title": "Engineer",
            "company": "CanaryCorp",
            "location": "Remote",
            "remote": "remote",
            "job_type": "full-time",
            "required_skills": ["Python"],
            "nice_to_have_skills": [],
            "experience_years_min": 1,
            "description": f"Role description {CANARY_TOKEN}",
            "url": "https://canarycorp.com/jobs/1",
            "fetched_at": "2026-10-18T10:00:00Z",
        },
        "question": f"Why do you want to work here with {CANARY_TOKEN}?",
        "profile": {
            "schema_version": 1,
            "name": f"Alex {CANARY_TOKEN}",
            "email": CANARY_EMAIL,
            "phone": "+1-555-0100",
            "location": "Remote",
            "links": {},
            "education": [],
            "experience": [],
            "projects": [],
            "skills": [
                {"name": "Python", "level": "strong"},
            ],
            "certifications": [],
            "preferences": {
                "locations": ["Remote"],
                "remote": "remote",
                "job_types": ["full-time"],
                "min_stipend": None,
                "avoid_keywords": [],
            },
        },
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/draft", json=draft_payload)
        assert res.status_code == 200

    # 4. Call /fill/map-fields with canary profile
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/fill/map-fields",
            json={
                "profile": draft_payload["profile"],
                "fields": [{"id": "f1", "label": f"Field {CANARY_TOKEN}", "type": "text"}],
            },
        )
        assert res.status_code == 200

    # 5. Call /email/classify with canary email
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/email/classify",
            json={
                "email": {
                    "sender": CANARY_EMAIL,
                    "subject": f"Update {CANARY_TOKEN}",
                    "date": "2026-10-18T10:00:00Z",
                    "body": f"Canary email text {CANARY_TOKEN}",
                },
                "candidates": [],
            },
        )
        assert res.status_code == 200

    # 6. VERIFY: Check SQLite database - canary must NOT be anywhere in tables
    db_path = Path(settings.JC_DB_PATH)
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]

        for table in tables:
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            for row in rows:
                row_str = str(row)
                assert CANARY_TOKEN not in row_str, f"Canary token found in table {table}: {row_str}"
                assert CANARY_EMAIL not in row_str, f"Canary email found in table {table}: {row_str}"
        conn.close()

    # 7. VERIFY: Check local backend disk files (excluding test code, venv, and git)
    backend_dir = Path(__file__).resolve().parents[2]
    ignored_patterns = {".venv", ".git", "test", "__pycache__", ".pytest_cache", ".ruff_cache", "site-packages"}
    for p in backend_dir.glob("**/*"):
        if any(part in ignored_patterns or part.startswith(".") for part in p.parts):
            continue
        if p.is_file() and not str(p).endswith(".py"):
            try:
                content = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue  # unreadable file: nothing to inspect
            assert CANARY_TOKEN not in content, f"Canary token leaked into file {p}"
            assert CANARY_EMAIL not in content, f"Canary email leaked into file {p}"
