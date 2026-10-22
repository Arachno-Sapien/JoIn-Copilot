from pathlib import Path

from pydantic import BaseModel

from app.llm import bharatcode
from app.llm import cache as llm_cache
from app.llm.client import clear_llm_cache, complete, get_llm_cache


class CacheSampleOutput(BaseModel):
    message: str


def counting_handler(fake_llm, template):
    calls = {"count": 0}

    def handler(inputs):
        calls["count"] += 1
        return CacheSampleOutput(message=f"Call {calls['count']}")

    fake_llm.register_handler(template=template, handler=handler)
    return calls


def ask(template, inputs, tier="small"):
    return complete(template=template, inputs=inputs, schema=CacheSampleOutput, tier=tier)


def test_identical_calls_are_served_from_the_in_memory_cache(fake_llm):
    calls = counting_handler(fake_llm, "cache_test.v1")
    assert ask("cache_test.v1", {"param": "value1"}).message == "Call 1"
    assert ask("cache_test.v1", {"param": "value1"}).message == "Call 1"
    assert calls["count"] == 1


def test_template_version_inputs_tier_and_model_each_change_the_key(fake_llm, monkeypatch):
    calls = counting_handler(fake_llm, "key_test.v1")
    counting_handler(fake_llm, "key_test.v2")
    ask("key_test.v1", {"p": 1})
    ask("key_test.v2", {"p": 1})
    ask("key_test.v1", {"p": 2})
    ask("key_test.v1", {"p": 1}, tier="strong")
    monkeypatch.setattr(bharatcode, "MODEL", "another-model")
    ask("key_test.v1", {"p": 1})
    assert calls["count"] == 4
    assert len(get_llm_cache()) == 5


def test_cache_is_bounded_and_evicts_the_least_recently_used_entry(fake_llm, monkeypatch):
    monkeypatch.setattr(llm_cache, "CACHE_MAX_ENTRIES", 3)
    calls = counting_handler(fake_llm, "bounded.v1")
    for n in range(4):
        ask("bounded.v1", {"n": n})
    assert len(get_llm_cache()) == 3
    ask("bounded.v1", {"n": 0})
    assert calls["count"] == 5


def test_mutating_a_result_does_not_change_the_cached_answer(fake_llm):
    counting_handler(fake_llm, "mutation.v1")
    first = ask("mutation.v1", {"x": 1})
    first.message = "tampered"
    assert ask("mutation.v1", {"x": 1}).message == "Call 1"


def test_cache_writes_nothing_to_disk(fake_llm):
    clear_llm_cache()
    fake_llm.register(template="disk_check.v1", inputs={"x": 1}, output=CacheSampleOutput(message="ok"))
    backend_dir = Path(__file__).resolve().parents[2]
    before = set(backend_dir.rglob("*"))
    ask("disk_check.v1", {"x": 1})
    ask("disk_check.v1", {"x": 1})
    new_files = [f for f in set(backend_dir.rglob("*")) - before if "__pycache__" not in f.parts]
    assert not new_files, f"cache wrote files to disk: {new_files}"
