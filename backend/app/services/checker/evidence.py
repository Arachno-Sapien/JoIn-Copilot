from app.schemas.profile import Bullet, Profile
from app.services.matching.embeddings import EmbeddingService, cosine_similarity


def get_profile_bullets(profile: Profile) -> list[Bullet]:
    bullets: list[Bullet] = []
    for exp in profile.experience:
        bullets.extend(exp.bullets)
    for proj in profile.projects:
        bullets.extend(proj.bullets)
    return bullets


def retrieve_claim_evidence(
    claim: str,
    cited_bullet_ids: list[str],
    profile: Profile,
    service: EmbeddingService | None = None,
    top_k_similar: int = 3,
) -> list[Bullet]:
    all_bullets = get_profile_bullets(profile)
    if not all_bullets:
        return []

    embedder = service or EmbeddingService()
    bullet_by_id = {b.id: b for b in all_bullets}

    selected: list[Bullet] = []
    seen_ids: set[str] = set()

    # 1. Add explicitly cited bullets first
    for cid in cited_bullet_ids:
        if cid in bullet_by_id and cid not in seen_ids:
            selected.append(bullet_by_id[cid])
            seen_ids.add(cid)

    # 2. Add embedding-similar bullets
    claim_vec = embedder.embed_text(claim)
    scored_bullets: list[tuple[float, Bullet]] = []
    for bullet in all_bullets:
        b_vec = embedder.embed_text(bullet.text)
        sim = cosine_similarity(claim_vec, b_vec)
        scored_bullets.append((sim, bullet))

    scored_bullets.sort(key=lambda item: item[0], reverse=True)

    for _, bullet in scored_bullets[:top_k_similar]:
        if bullet.id not in seen_ids:
            selected.append(bullet)
            seen_ids.add(bullet.id)

    return selected
