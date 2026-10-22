import json
import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.config import settings
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

TIER_SETTINGS = {"small": "JC_LLM_SMALL_MODEL", "strong": "JC_LLM_STRONG_MODEL"}


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
    if tier not in TIER_SETTINGS:
        raise ValueError(f"unknown model tier {tier!r}; use 'small' or 'strong'")
    name = TIER_SETTINGS[tier]
    return os.environ.get(name) or getattr(settings, name)


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
) -> tuple[str, str, T | None]:
    """Return (cache key, model, answer). The answer is None when the provider must be called."""
    model = get_model_for_tier(tier)
    key = make_cache_key(template, inputs, tier, model)
    cached = cache_get(key)
    if cached is not None:
        return key, model, _validate(schema, cached)

    if (os.environ.get("JC_LLM_MODE") or settings.JC_LLM_MODE) == "mock":
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
        return key, model, answer

    if not model:
        raise ValueError(f"{TIER_SETTINGS[tier]} is not set; configure a model for the {tier} tier")
    return key, model, None


def complete[T: BaseModel](
    template: str,
    inputs: dict[str, Any],
    schema: type[T],
    tier: str = "small",
) -> T:
    """Blocking call for scripts and evaluations. Endpoints use acomplete."""
    key, model, answer = _prepare(template, inputs, schema, tier)
    if answer is not None:
        return answer
    import litellm

    # Never pass tools or functions, only prompt messages.
    response = litellm.completion(
        model=model,
        messages=render_prompt_template(template, inputs),
        response_format={"type": "json_object"},
    )
    answer = schema.model_validate_json(response.choices[0].message.content)
    cache_set(key, answer)
    return answer


async def acomplete[T: BaseModel](
    template: str,
    inputs: dict[str, Any],
    schema: type[T],
    tier: str = "small",
) -> T:
    """Async call for FastAPI endpoints, so a slow model never blocks the event loop."""
    key, model, answer = _prepare(template, inputs, schema, tier)
    if answer is not None:
        return answer
    import litellm

    # Never pass tools or functions, only prompt messages.
    response = await litellm.acompletion(
        model=model,
        messages=render_prompt_template(template, inputs),
        response_format={"type": "json_object"},
    )
    answer = schema.model_validate_json(response.choices[0].message.content)
    cache_set(key, answer)
    return answer
