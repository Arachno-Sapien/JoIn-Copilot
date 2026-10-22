from app.schemas.job import Job
from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.services.matching.recall import embedding_recall


def make_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Alex Doe",
        email="alex@example.com",
        phone="1234567890",
        location="Bangalore, India",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Backend Engineer",
                org="Tech Innovators",
                start="2022-01",
                end="2024-01",
                bullets=[
                    Bullet(id="b1", text="Developed high throughput REST APIs using FastAPI and Python."),
                    Bullet(id="b2", text="Architected database schemas with PostgreSQL and Redis caching."),
                ],
            )
        ],
        projects=[],
        skills=[
            Skill(name="Python", level="strong"),
            Skill(name="FastAPI", level="strong"),
            Skill(name="PostgreSQL", level="working"),
            Skill(name="Redis", level="working"),
        ],
        certifications=[],
        preferences=Preferences(locations=["Bangalore"], remote="any"),
    )


def test_embedding_recall_caps_at_50_and_sorts_descending():
    profile = make_profile()

    # Generate 60 test jobs with varying relevance
    jobs: list[Job] = []
    # 5 highly relevant jobs
    for i in range(5):
        jobs.append(
            Job(
                id=f"job-rel-{i}",
                source="manual",
                source_id=f"rel-{i}",
                url=f"https://example.com/rel/{i}",
                title="Python FastAPI Backend Engineer",
                company=f"Company {i}",
                location="Bangalore",
                remote="hybrid",
                job_type="full-time",
                required_skills=["Python", "FastAPI", "PostgreSQL"],
                description="We need an experienced Python FastAPI developer with PostgreSQL and Redis skills.",
                fetched_at="2026-10-18T12:00:00Z",
            )
        )

    # 55 less relevant or generic jobs
    for i in range(55):
        jobs.append(
            Job(
                id=f"job-gen-{i}",
                source="manual",
                source_id=f"gen-{i}",
                url=f"https://example.com/gen/{i}",
                title=f"Generic Role {i}",
                company=f"Corp {i}",
                location="Bangalore",
                remote="hybrid",
                job_type="full-time",
                required_skills=["Office", "Spreadsheets"],
                description=f"Generic administrative tasks and customer communications {i}.",
                fetched_at="2026-10-18T12:00:00Z",
            )
        )

    assert len(jobs) == 60

    recalled = embedding_recall(profile, jobs, limit=50)

    # Must be capped at 50
    assert len(recalled) == 50

    # Must be sorted in descending order of similarity
    similarities = [r.similarity for r in recalled]
    for i in range(len(similarities) - 1):
        assert similarities[i] >= similarities[i + 1], f"Not descending at {i}: {similarities[i]} < {similarities[i+1]}"

    # The top 5 should be the highly relevant jobs
    top_ids = [r.job.id for r in recalled[:5]]
    for i in range(5):
        assert f"job-rel-{i}" in top_ids
