import json

from app.llm.client import acomplete
from app.schemas.fill import FieldMapping, FormFieldInput, MapFieldsModelOutput
from app.schemas.profile import Profile


def _format_profile(profile: Profile) -> str:
    summary = {
        "name": profile.name,
        "email": profile.email,
        "phone": profile.phone,
        "location": profile.location,
        "links": profile.links,
        "skills": [s.name for s in profile.skills],
    }
    return json.dumps(summary, indent=2)


def _format_fields(fields: list[FormFieldInput]) -> str:
    lines = []
    for f in fields:
        opt_str = f" options={f.options}" if f.options else ""
        lines.append(f"- id={f.id} label='{f.label}' type={f.type}{opt_str}")
    return "\n".join(lines)


async def map_form_fields(
    profile: Profile,
    fields: list[FormFieldInput],
) -> list[FieldMapping]:
    if not fields:
        return []

    inputs = {
        "profile_data": _format_profile(profile),
        "fields_list": _format_fields(fields),
    }

    raw = await acomplete(
        tier="small",
        template="map_fields.v1.md",
        inputs=inputs,
        schema=MapFieldsModelOutput,
    )

    if isinstance(raw, MapFieldsModelOutput):
        mappings = raw.fields
    elif isinstance(raw, dict):
        validated = MapFieldsModelOutput.model_validate(raw)
        mappings = validated.fields
    else:
        mappings = []

    # Map input fields by ID for lookup
    fields_by_id = {f.id: f for f in fields}
    allowed_urls = set(profile.links.values())

    result: list[FieldMapping] = []
    for m in mappings:
        field_input = fields_by_id.get(m.field_id)
        field_type = (field_input.type if field_input else "").lower()
        field_label = (field_input.label if field_input else m.field_name).lower()

        # Normalize open question status
        if m.action == "open_question" or m.is_open_question:
            m.action = "open_question"
            m.is_open_question = True
            m.value = None
            m.profile_path = None

        # G2 Safety Enforcement: Email fields
        is_email_field = (
            field_type == "email"
            or "email" in field_label
            or "email" in m.field_name.lower()
        )
        if is_email_field and m.action == "fill" and m.value != profile.email:
            m.value = None
            m.is_flagged = True
            m.flag_reason = "Dropped unverified email; only profile email is permitted."

        # G2 Safety Enforcement: URL fields
        is_url_field = (
            field_type == "url"
            or any(kw in field_label for kw in ("url", "website", "link", "linkedin", "github", "portfolio"))
            or any(kw in m.field_name.lower() for kw in ("url", "website", "link", "linkedin", "github", "portfolio"))
        )
        if is_url_field and m.action == "fill" and m.value and m.value not in allowed_urls:
            m.value = None
            m.is_flagged = True
            m.flag_reason = "Dropped unverified URL; only profile links are permitted."

        result.append(m)

    return result
