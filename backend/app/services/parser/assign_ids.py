from app.schemas.profile import Profile


def assign_stable_bullet_ids(profile: Profile) -> Profile:
    updated_exp = []
    for i, exp in enumerate(profile.experience):
        exp_id = exp.id or f"exp-{i + 1}"
        updated_bullets = []
        for j, bullet in enumerate(exp.bullets):
            updated_bullets.append(bullet.model_copy(update={"id": f"exp-{i + 1}-b{j + 1}"}))
        updated_exp.append(exp.model_copy(update={"id": exp_id, "bullets": updated_bullets}))

    updated_proj = []
    for i, proj in enumerate(profile.projects):
        proj_id = proj.id or f"proj-{i + 1}"
        updated_bullets = []
        for j, bullet in enumerate(proj.bullets):
            updated_bullets.append(bullet.model_copy(update={"id": f"proj-{i + 1}-b{j + 1}"}))
        updated_proj.append(proj.model_copy(update={"id": proj_id, "bullets": updated_bullets}))

    updated_edu = []
    for i, edu in enumerate(profile.education):
        edu_id = edu.id or f"edu-{i + 1}"
        updated_edu.append(edu.model_copy(update={"id": edu_id}))

    updated_cert = []
    for i, cert in enumerate(profile.certifications):
        cert_id = cert.id or f"cert-{i + 1}"
        updated_cert.append(cert.model_copy(update={"id": cert_id}))

    return profile.model_copy(
        update={
            "experience": updated_exp,
            "projects": updated_proj,
            "education": updated_edu,
            "certifications": updated_cert,
        }
    )
