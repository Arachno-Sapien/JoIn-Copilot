import re

from app.schemas.profile import Bullet, Experience, Preferences, Profile, Project
from app.services.parser.assign_ids import assign_stable_bullet_ids


def make_test_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Alex Doe",
        email="alex@example.com",
        phone="+1234567890",
        location="Bangalore",
        experience=[
            Experience(
                id="exp-1",
                role="Senior Engineer",
                org="Acme Corp",
                start="2022-01",
                end="present",
                bullets=[
                    Bullet(id="", text="Designed distributed systems."),
                    Bullet(id="", text="Mentored junior engineers."),
                ],
            ),
            Experience(
                id="exp-2",
                role="Engineer",
                org="Beta Labs",
                start="2020-01",
                end="2021-12",
                bullets=[
                    Bullet(id="", text="Built user facing web applications."),
                ],
            ),
        ],
        projects=[
            Project(
                id="proj-1",
                name="Job Copilot",
                bullets=[
                    Bullet(id="", text="Created Chrome MV3 extension."),
                    Bullet(id="", text="Implemented backend API in FastAPI."),
                ],
            ),
            Project(
                id="proj-2",
                name="Cloud Optimizer",
                bullets=[
                    Bullet(id="", text="Reduced cloud billing by 25%."),
                ],
            ),
        ],
        skills=[],
        preferences=Preferences(
            locations=["Bangalore"],
            remote="hybrid",
            job_types=["full-time"],
        ),
    )


def test_every_bullet_gets_formatted_id():
    profile = make_test_profile()
    processed = assign_stable_bullet_ids(profile)

    exp_pattern = re.compile(r"^exp-\d+-b\d+$")
    proj_pattern = re.compile(r"^proj-\d+-b\d+$")

    all_ids = []
    for exp in processed.experience:
        for bullet in exp.bullets:
            assert exp_pattern.match(bullet.id), f"Invalid experience bullet ID format: {bullet.id}"
            all_ids.append(bullet.id)

    for proj in processed.projects:
        for bullet in proj.bullets:
            assert proj_pattern.match(bullet.id), f"Invalid project bullet ID format: {bullet.id}"
            all_ids.append(bullet.id)

    # Every ID must be unique
    assert len(all_ids) == len(set(all_ids))
    assert processed.experience[0].bullets[0].id == "exp-1-b1"
    assert processed.experience[0].bullets[1].id == "exp-1-b2"
    assert processed.experience[1].bullets[0].id == "exp-2-b1"
    assert processed.projects[0].bullets[0].id == "proj-1-b1"
    assert processed.projects[0].bullets[1].id == "proj-1-b2"
    assert processed.projects[1].bullets[0].id == "proj-2-b1"


def test_parsing_same_resume_twice_yields_same_ids():
    p1 = make_test_profile()
    p2 = make_test_profile()

    processed1 = assign_stable_bullet_ids(p1)
    processed2 = assign_stable_bullet_ids(p2)

    ids1 = [b.id for exp in processed1.experience for b in exp.bullets] + [
        b.id for proj in processed1.projects for b in proj.bullets
    ]
    ids2 = [b.id for exp in processed2.experience for b in exp.bullets] + [
        b.id for proj in processed2.projects for b in proj.bullets
    ]

    assert ids1 == ids2
