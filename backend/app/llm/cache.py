import json
import threading
from collections import OrderedDict
from typing import Any

from pydantic import BaseModel

# ponytail: one process-wide LRU; size it from memory use if a shared hosted backend appears.
CACHE_MAX_ENTRIES = 512

_CACHE: OrderedDict[str, BaseModel] = OrderedDict()
_LOCK = threading.Lock()  # sync complete() runs in FastAPI's thread pool


def make_cache_key(template: str, inputs: dict[str, Any], tier: str, model: str) -> str:
    serialized_inputs = json.dumps(inputs, sort_keys=True, default=str)
    return f"{template}:{tier}:{model}:{serialized_inputs}"


def get_llm_cache() -> OrderedDict[str, BaseModel]:
    return _CACHE


def clear_llm_cache() -> None:
    with _LOCK:
        _CACHE.clear()


def cache_get(key: str) -> BaseModel | None:
    with _LOCK:
        value = _CACHE.get(key)
        if value is None:
            return None
        _CACHE.move_to_end(key)
    # Callers get their own copy, so mutating a result never changes the cache.
    return value.model_copy(deep=True)


def cache_set(key: str, value: BaseModel) -> None:
    with _LOCK:
        _CACHE[key] = value.model_copy(deep=True)
        _CACHE.move_to_end(key)
        while len(_CACHE) > CACHE_MAX_ENTRIES:
            _CACHE.popitem(last=False)
