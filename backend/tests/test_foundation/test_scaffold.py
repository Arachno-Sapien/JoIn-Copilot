from app.config import settings
from app.schemas.common import ErrorResponse


def test_settings_loaded():
    assert settings.JC_LLM_MODE in ("live", "mock")
    assert settings.JC_EMBED_MODE in ("model", "fake")


def test_error_response_model():
    err = ErrorResponse(error="Not found", detail="Item does not exist")
    assert err.error == "Not found"
    assert err.detail == "Item does not exist"
