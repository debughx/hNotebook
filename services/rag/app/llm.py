from typing import Any

import httpx

from app.config import Settings


async def chat_completion(
    settings: Settings,
    client: httpx.AsyncClient,
    system_prompt: str,
    user_message: str,
    *,
    base_url: str | None = None,
    api_key: str | None = None,
    chat_model: str | None = None,
    history: list[dict[str, str]] | None = None,
) -> str:
    effective_api_key = (api_key or settings.openai_api_key).strip()
    hist = history or []
    if not effective_api_key:
        hist_lines = "\n".join(
            f"{h.get('role', '')}: {(h.get('content', '') or '')[:400]}"
            for h in hist
            if h.get("role") in ("user", "assistant") and (h.get("content") or "").strip()
        )
        tail = (
            f"\n\n----\n此前对话摘要：\n{hist_lines}\n\n----\n你的问题：\n{user_message}"
            if hist_lines
            else f"\n\n----\n你的问题：\n{user_message}"
        )
        return (
            "（演示模式：未配置 OPENAI_API_KEY）\n\n"
            + system_prompt[:2000]
            + tail
        )

    url = (base_url or settings.openai_base_url).rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {effective_api_key}",
        "Content-Type": "application/json",
    }
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for h in hist:
        r = h.get("role", "")
        c = (h.get("content") or "").strip()
        if r in ("user", "assistant") and c:
            messages.append({"role": r, "content": c})
    messages.append({"role": "user", "content": user_message})
    body: dict[str, Any] = {
        "model": chat_model or settings.chat_model,
        "messages": messages,
        "temperature": 0.3,
    }
    resp = await client.post(url, headers=headers, json=body, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    return str(data["choices"][0]["message"]["content"]).strip()
