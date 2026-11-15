import functools
import hashlib
import logging
import math
import os
import re
from collections.abc import Sequence

from app.config import settings

logger = logging.getLogger(__name__)

EMBED_DIM = 384


def _tokenize(text: str) -> list[str]:
    return [w.lower() for w in re.findall(r"\b[A-Za-z0-9_+#.-]+\b", text) if len(w) > 1]


def _fake_embed(text: str, dim: int = EMBED_DIM) -> list[float]:
    """Deterministic, bag-of-words hash embedding producing unit L2-norm vectors."""
    tokens = _tokenize(text)
    if not tokens:
        # Return a deterministic baseline vector
        vec = [0.0] * dim
        vec[0] = 1.0
        return vec

    vec = [0.0] * dim
    for token in tokens:
        h = hashlib.sha256(token.encode("utf-8")).digest()
        # Derive 4 index-sign pairs per token
        for i in range(4):
            idx = int.from_bytes(h[i * 4 : i * 4 + 2], "big") % dim
            sign = 1.0 if (h[i * 4 + 2] % 2 == 0) else -1.0
            vec[idx] += sign

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    else:
        vec[0] = 1.0
    return vec


@functools.lru_cache(maxsize=1)
def load_fastembed_model(model_name: str):
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=model_name)


_warned_models: set[str] = set()


def get_embedding_model(model_name: str):
    try:
        return load_fastembed_model(model_name)
    except Exception as exc:  # noqa: BLE001
        if model_name not in _warned_models:
            logger.warning(
                "Embedding model '%s' failed to load (%s); fake embedding is in use.",
                model_name,
                type(exc).__name__,
            )
            _warned_models.add(model_name)
        return None


class EmbeddingService:
    def __init__(self) -> None:
        self.mode = (os.environ.get("JC_EMBED_MODE") or settings.JC_EMBED_MODE).lower()
        self.model_name = settings.JC_EMBED_MODEL
        self._model = None
        if self.mode != "fake":
            self._model = get_embedding_model(self.model_name)

    def embed_text(self, text: str) -> list[float]:
        return self.embed_batch([text])[0]

    def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        if self.mode == "fake" or self._model is None:
            return [_fake_embed(t) for t in texts]

        try:
            embeddings = list(self._model.embed(texts))
            return [[float(x) for x in emb] for emb in embeddings]
        except Exception:  # noqa: BLE001
            return [_fake_embed(t) for t in texts]


def cosine_similarity(v1: Sequence[float], v2: Sequence[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))

