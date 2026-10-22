from app.schemas.profile import Bullet, Experience, Preferences, Profile, Skill
from app.services.checker.evidence import retrieve_claim_evidence


def sample_profile() -> Profile:
    return Profile(
        schema_version=1,
        name="Alex Smith",
        email="alex@example.com",
        phone="555-0100",
        location="Seattle, WA",
        education=[],
        experience=[
            Experience(
                id="exp-1",
                role="Backend Engineer",
                org="Cloud Systems",
                start="2022-01",
                end="2024-01",
                bullets=[
                    Bullet(id="exp-1-b1", text="Wrote unit and integration tests with pytest."),
                    Bullet(id="exp-1-b2", text="Deployed microservices to AWS Elastic Kubernetes Service."),
                    Bullet(id="exp-1-b3", text="Maintained legacy MySQL database schemas and indexing."),
                ],
            )
        ],
        projects=[],
        skills=[Skill(name="Python", level="strong")],
        certifications=[],
        preferences=Preferences(),
    )


def test_evidence_combines_cited_bullets_and_embedding_similar_bullets():
    profile = sample_profile()
    claim_text = "I have extensive experience with Kubernetes container deployment."
    # Draft explicitly cited exp-1-b1 (even though b1 is pytest)
    cited_ids = ["exp-1-b1"]

    evidence_bullets = retrieve_claim_evidence(
        claim=claim_text,
        cited_bullet_ids=cited_ids,
        profile=profile,
    )

    evidence_ids = [b.id for b in evidence_bullets]

    # Must contain the explicitly cited bullet
    assert "exp-1-b1" in evidence_ids

    # Must contain the most embedding-similar bullet for Kubernetes (exp-1-b2)
    assert "exp-1-b2" in evidence_ids

    # No duplicate bullets
    assert len(evidence_ids) == len(set(evidence_ids))
