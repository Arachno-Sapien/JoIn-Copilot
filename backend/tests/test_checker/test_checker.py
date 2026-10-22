from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.services.checker.evidence import retrieve_claim_evidence


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Casey Morgan",
        email="casey@example.com",
        phone="555-9876",
        location="Denver, CO",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="DevOps Engineer",
                org="DevOps Inc",
                start="2022-01",
                end="2024-01",
                bullets=[Bullet(id="exp-1-b1", text="Managed Docker and Kubernetes infrastructure.")],
            )
        ],
        projects=[],
        skills=[Skill(name="Docker", level="strong")],
        certifications=[],
        preferences=Preferences(),
    )


def test_evidence_retrieval_empty_profile():
    prof = sample_profile()
    prof.experience = []
    evidence = retrieve_claim_evidence("Docker deployment", [], prof)
    assert evidence == []


def test_evidence_retrieval_no_citations():
    prof = sample_profile()
    evidence = retrieve_claim_evidence("Kubernetes infrastructure", [], prof)
    assert len(evidence) == 1
    assert evidence[0].id == "exp-1-b1"
