import json
import os
import sqlite3

from app.config import settings
from app.schemas.job import Job


class JobCache:
    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or settings.JC_DB_PATH or "jobs.sqlite"

    def _get_connection(self) -> sqlite3.Connection:
        # Ensure parent directory exists if a path is specified
        dirname = os.path.dirname(self.db_path)
        if dirname:
            os.makedirs(dirname, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    company TEXT NOT NULL,
                    location TEXT NOT NULL,
                    remote TEXT NOT NULL,
                    job_type TEXT NOT NULL,
                    required_skills TEXT NOT NULL,
                    nice_to_have_skills TEXT NOT NULL,
                    experience_years_min REAL,
                    description TEXT NOT NULL,
                    posted_at TEXT,
                    deadline TEXT,
                    fetched_at TEXT NOT NULL
                )
                """
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_jobs_company_title ON jobs (company, title)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_jobs_fetched_at ON jobs (fetched_at DESC)"
            )
            conn.commit()

    def upsert_jobs(self, jobs: list[Job]) -> None:
        if not jobs:
            return
        self.init_db()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = """
                INSERT INTO jobs (
                    id, source, source_id, url, title, company, location,
                    remote, job_type, required_skills, nice_to_have_skills,
                    experience_years_min, description, posted_at, deadline, fetched_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    source=excluded.source,
                    source_id=excluded.source_id,
                    url=excluded.url,
                    title=excluded.title,
                    company=excluded.company,
                    location=excluded.location,
                    remote=excluded.remote,
                    job_type=excluded.job_type,
                    required_skills=excluded.required_skills,
                    nice_to_have_skills=excluded.nice_to_have_skills,
                    experience_years_min=excluded.experience_years_min,
                    description=excluded.description,
                    posted_at=excluded.posted_at,
                    deadline=excluded.deadline,
                    fetched_at=excluded.fetched_at
            """
            rows = [
                (
                    j.id,
                    j.source,
                    j.source_id,
                    j.url,
                    j.title,
                    j.company,
                    j.location,
                    j.remote,
                    j.job_type,
                    json.dumps(j.required_skills),
                    json.dumps(j.nice_to_have_skills),
                    j.experience_years_min,
                    j.description,
                    j.posted_at,
                    j.deadline,
                    j.fetched_at,
                )
                for j in jobs
            ]
            cursor.executemany(query, rows)
            conn.commit()

    def _row_to_job(self, row: sqlite3.Row) -> Job:
        return Job(
            id=row["id"],
            source=row["source"],
            source_id=row["source_id"],
            url=row["url"],
            title=row["title"],
            company=row["company"],
            location=row["location"],
            remote=row["remote"],
            job_type=row["job_type"],
            required_skills=json.loads(row["required_skills"]),
            nice_to_have_skills=json.loads(row["nice_to_have_skills"]),
            experience_years_min=row["experience_years_min"],
            description=row["description"],
            posted_at=row["posted_at"],
            deadline=row["deadline"],
            fetched_at=row["fetched_at"],
        )

    def get_job(self, job_id: str) -> Job | None:
        self.init_db()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_job(row)

    def list_jobs(self, limit: int = 100, offset: int = 0) -> list[Job]:
        self.init_db()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM jobs ORDER BY fetched_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            rows = cursor.fetchall()
            return [self._row_to_job(r) for r in rows]
