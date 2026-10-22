import pytest

from app.config import settings
from app.llm.cache import clear_llm_cache
from app.llm.client import MockRegistry, get_mock_registry


@pytest.fixture(autouse=True)
def force_mock_mode_and_clear_cache(monkeypatch):
    monkeypatch.setenv("JC_LLM_MODE", "mock")
    monkeypatch.setenv("JC_EMBED_MODE", "fake")
    monkeypatch.setattr(settings, "JC_LLM_MODE", "mock")
    monkeypatch.setattr(settings, "JC_EMBED_MODE", "fake")
    registry = get_mock_registry()
    registry.clear()
    clear_llm_cache()
    yield
    registry.clear()
    clear_llm_cache()


@pytest.fixture
def fake_llm() -> MockRegistry:
    return get_mock_registry()
