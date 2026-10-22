import hashlib
import math
import os
import re
from collections.abc import Sequence

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


class EmbeddingService:
    def __init__(self) -> None:
        self.mode = os.environ.get("JC_EMBED_MODE", "fake").lower()
        self._model = None
        if self.mode != "fake":
            try:
                from fastembed import TextEmbedding

                self._model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            except Exception:  # noqa: BLE001
                try:
                    from sentence_transformers import SentenceTransformer

                    self._model = SentenceTransformer("BAAI/bge-small-en-v1.5")
                except Exception:  # noqa: BLE001
                    self._model = None

    def embed_text(self, text: str) -> list[float]:
        if self.mode == "fake" or self._model is None:
            return _fake_embed(text)

        # Real model embedding
        try:
            if hasattr(self._model, "embed"):  # fastembed
                embeddings = list(self._model.embed([text]))
                return [float(x) for x in embeddings[0]]
            elif hasattr(self._model, "encode"):  # sentence-transformers
                emb = self._model.encode(text)
                return [float(x) for x in emb]
        except Exception:  # noqa: BLE001
            return _fake_embed(text)

        return _fake_embed(text)

    def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        return [self.embed_text(t) for t in texts]


def cosine_similarity(v1: Sequence[float], v2: Sequence[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))
