import hashlib
import math
import random
from typing import Any

import httpx

from app.config import Settings


def _mock_embedding(text: str, dim: int) -> list[float]:
    seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:16], 16)
    rng = random.Random(seed)
    vec = [rng.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


async def embed_texts(settings: Settings, texts: list[str], client: httpx.AsyncClient) -> list[list[float]]:
    return await embed_texts_with_runtime(
        settings,
        texts,
        client,
        base_url=None,
        api_key=None,
        embedding_model=None,
    )


async def embed_texts_with_runtime(
    settings: Settings,
    texts: list[str],
    client: httpx.AsyncClient,
    base_url: str | None,
    api_key: str | None,
    embedding_model: str | None,
) -> list[list[float]]:
    effective_api_key = (api_key or settings.openai_api_key).strip()
    if not effective_api_key:
        return [_mock_embedding(t, settings.embedding_dimensions) for t in texts]

    url = (base_url or settings.openai_base_url).rstrip("/") + "/embeddings"
    headers = {
        "Authorization": f"Bearer {effective_api_key}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "model": embedding_model or settings.embedding_model,
        "input": texts,
    }
    resp = await client.post(url, headers=headers, json=body, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    out: list[list[float]] = []
    for item in sorted(data["data"], key=lambda x: x["index"]):
        out.append(item["embedding"])
    return out


def cosine_sim(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
