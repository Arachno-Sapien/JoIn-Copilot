import asyncio
import json
import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.config import settings
from app.llm import bharatcode
from app.llm.cache import (
    cache_get,
    cache_set,
    clear_llm_cache,
    get_llm_cache,
    make_cache_key,
)
from app.llm.prompts import render_prompt_template

__all__ = [
    "MockLLMUnregisteredError",
    "MockRegistry",
    "acomplete",
    "clear_llm_cache",
    "complete",
    "get_llm_cache",
    "get_mock_registry",
    "get_model_for_tier",
]

TIERS = ("small", "strong")

# Output budget (reasoning included) and reasoning effort per prompt. None leaves
# reasoning to the model, for the tasks that need judgment. A truncated answer is
# reported, never retried with the same budget.
TASK_LIMITS: dict[str, tuple[int, str | None]] = {
    "parse_resume": (8000, "none"),
    "parse_resume_retry": (8000, "none"),
    "draft": (4000, None),
    "rewrite": (4000, None),
    "judge": (2000, None),
}
DEFAULT_LIMITS = (2000, "none")


class MockLLMUnregisteredError(RuntimeError):
    pass


def _serialize(inputs: dict[str, Any]) -> str:
    return json.dumps(inputs, sort_keys=True, default=str)


class MockRegistry:
    def __init__(self) -> None:
        self.exact_matches: dict[tuple[str, str], BaseModel | dict[str, Any]] = {}
        self.handlers: dict[str, Callable[[dict[str, Any]], BaseModel | dict[str, Any]]] = {}

    def clear(self) -> None:
        self.exact_matches.clear()
        self.handlers.clear()

    def register(self, template: str, inputs: dict[str, Any], output: BaseModel | dict[str, Any]) -> None:
        self.exact_matches[(template, _serialize(inputs))] = output

    def register_handler(
        self, template: str, handler: Callable[[dict[str, Any]], BaseModel | dict[str, Any]]
    ) -> None:
        self.handlers[template] = handler

    def get_output(self, template: str, inputs: dict[str, Any]) -> BaseModel | dict[str, Any] | None:
        key = (template, _serialize(inputs))
        if key in self.exact_matches:
            return self.exact_matches[key]
        if template in self.handlers:
            return self.handlers[template](inputs)
        return None


_GLOBAL_MOCK_REGISTRY = MockRegistry()


def get_mock_registry() -> MockRegistry:
    return _GLOBAL_MOCK_REGISTRY


def get_model_for_tier(tier: str) -> str:
    """Both tiers run on the one BharatCode model; the tier still sets the cache key."""
    if tier not in TIERS:
        raise ValueError(f"unknown model tier {tier!r}; use 'small' or 'strong'")
    return bharatcode.MODEL


def _task_limits(template: str) -> tuple[int, str | None]:
    return TASK_LIMITS.get(Path(template).name.split(".")[0], DEFAULT_LIMITS)


def _validate[T: BaseModel](schema: type[T], value: BaseModel | dict[str, Any]) -> T:
    # Always a fresh instance, so callers never share an object with the registry or cache.
    return schema.model_validate(value.model_dump() if isinstance(value, BaseModel) else value)


def _fixture_output(template: str, inputs: dict[str, Any]) -> dict[str, Any] | None:
    path = os.environ.get("JC_LLM_FIXTURES") or settings.JC_LLM_FIXTURES
    if not path:
        return None
    # A missing or malformed fixture file raises here instead of looking like an unregistered call.
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return data.get(template, {}).get(_serialize(inputs))


def _prepare[T: BaseModel](
    template: str, inputs: dict[str, Any], schema: type[T], tier: str
) -> tuple[str, T | None]:
    """Return (cache key, answer). The answer is None when BharatCode must be called."""
    model = get_model_for_tier(tier)
    mock = (os.environ.get("JC_LLM_MODE") or settings.JC_LLM_MODE) == "mock"
    if not mock and not bharatcode.request_key.get():
        # Checked before the cache, so a cached answer never hides the missing-key message.
        raise bharatcode.MissingKeyError()

    key = make_cache_key(template, inputs, tier, model)
    cached = cache_get(key)
    if cached is not None:
        return key, _validate(schema, cached)

    if mock:
        output = _GLOBAL_MOCK_REGISTRY.get_output(template, inputs)
        if output is None:
            output = _fixture_output(template, inputs)
        if output is None:
            # Input keys only: values can be personal data and errors end up in logs.
            raise MockLLMUnregisteredError(
                f"no mock registered for template '{template}' with input keys {sorted(inputs)}"
            )
        answer = _validate(schema, output)
        cache_set(key, answer)
        return key, answer
    return key, None


async def acomplete[T: BaseModel](
    template: str,
    inputs: dict[str, Any],
    schema: type[T],
    tier: str = "small",
) -> T:
    """Ask BharatCode for a reply matching schema. Endpoints await this."""
    key, answer = _prepare(template, inputs, schema, tier)
    if answer is not None:
        return answer

    system, user = render_prompt_template(template, inputs)
    max_output_tokens, effort = _task_limits(template)
    text = await bharatcode.respond(
        instructions=system["content"],
        user_input=user["content"],
        schema_name=schema.__name__,
        json_schema=schema.model_json_schema(),
        max_output_tokens=max_output_tokens,
        effort=effort,
    )
    answer = schema.model_validate_json(text)
    cache_set(key, answer)
    return answer


def complete[T: BaseModel](
    template: str,
    inputs: dict[str, Any],
    schema: type[T],
    tier: str = "small",
) -> T:
    """Blocking form of acomplete for scripts and tests. Never call it inside an event loop."""
    return asyncio.run(acomplete(template, inputs, schema, tier))
