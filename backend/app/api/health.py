from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.llm import provider

router = APIRouter()


class _Check(BaseModel):
    ok: bool


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.post("/llm/check")
async def llm_check():
    """Options page "Test connection": one tiny structured call to the caller's provider, never cached."""
    model = provider.connection().model
    text = await provider.respond(
        instructions='Reply with the JSON object {"ok": true}.',
        user_input="Are you there?",
        schema_name="Check",
        json_schema=_Check.model_json_schema(),
    )
    try:
        _Check.model_validate_json(text)
    except ValidationError as err:
        raise provider.RequestFailedError(
            f"{model} answered, but not with the JSON asked for. Pick a model that supports structured output."
        ) from err
    return {"ok": True, "model": model}
