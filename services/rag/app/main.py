from contextlib import asynccontextmanager
import asyncio
import hashlib
import json
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.authn import get_user_id
from app.chunking import chunk_text
from app.config import Settings, get_settings
from app.embeddings import cosine_sim, embed_texts_with_runtime
from app.llm import chat_completion
from app.store import StoredChunk, store


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    store.configure(settings.rag_store_path)
    async with httpx.AsyncClient() as client:
        app.state.http = client
        yield


def get_http(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


app = FastAPI(
    title="hNotebook RAG",
    description="Ingest notes, retrieve, chat via OpenAI-compatible API (or demo mode).",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"service": "hnotebook-rag", "status": "ok"}


class IngestRequest(BaseModel):
    source_id: str = Field(..., min_length=1, max_length=200)
    title: str = Field("", max_length=500)
    text: str = ""
    base_url: str | None = Field(None, max_length=500)
    api_key: str | None = Field(None, max_length=500)
    embedding_model: str | None = Field(None, max_length=200)
    chat_model: str | None = Field(None, max_length=200)


class RuntimeConfigRequest(BaseModel):
    base_url: str = Field("", max_length=500)
    api_key: str = Field("", max_length=500)
    embedding_model: str = Field("", max_length=200)
    chat_model: str = Field("", max_length=200)


def _resolve_runtime(
    user_id: UUID,
    *,
    base_url: str | None,
    api_key: str | None,
    embedding_model: str | None,
    chat_model: str | None,
) -> dict[str, str | None]:
    saved = store.get_runtime_config(str(user_id))

    def pick(req: str | None, saved_val: str) -> str | None:
        if req is not None:
            v = req.strip()
            return v or None
        sv = saved_val.strip()
        return sv or None

    return {
        "base_url": pick(base_url, saved["base_url"]),
        "api_key": pick(api_key, saved["api_key"]),
        "embedding_model": pick(embedding_model, saved["embedding_model"]),
        "chat_model": pick(chat_model, saved["chat_model"]),
    }


@app.get("/config")
async def get_config(user_id: Annotated[UUID, Depends(get_user_id)]):
    return store.get_runtime_config(str(user_id))


@app.put("/config")
async def put_config(
    body: RuntimeConfigRequest,
    user_id: Annotated[UUID, Depends(get_user_id)],
):
    store.set_runtime_config(
        str(user_id),
        base_url=body.base_url.strip(),
        api_key=body.api_key.strip(),
        embedding_model=body.embedding_model.strip(),
        chat_model=body.chat_model.strip(),
    )
    return store.get_runtime_config(str(user_id))


def _ingest_content_hash(title: str, text: str) -> str:
    """Matches web: title strip + '\\n---\\n' + body (UTF-8 SHA-256 hex)."""
    raw = (title or "").strip() + "\n---\n" + (text or "")
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@app.get("/ingest/sources")
async def list_ingest_sources(user_id: Annotated[UUID, Depends(get_user_id)]):
    return store.list_ingested_sources(str(user_id))


@app.post("/ingest")
async def ingest(
    body: IngestRequest,
    user_id: Annotated[UUID, Depends(get_user_id)],
    settings: Annotated[Settings, Depends(get_settings)],
    http: Annotated[httpx.AsyncClient, Depends(get_http)],
):
    try:
        runtime = _resolve_runtime(
            user_id,
            base_url=body.base_url,
            api_key=body.api_key,
            embedding_model=body.embedding_model,
            chat_model=body.chat_model,
        )
        chunks_text = chunk_text(body.text, settings.chunk_size, settings.chunk_overlap)
        if not chunks_text:
            store.replace_source(str(user_id), body.source_id, [])
            return {"ingested": 0, "sourceId": body.source_id}

        body_hash = _ingest_content_hash(body.title, body.text)
        embeddings = await embed_texts_with_runtime(
            settings,
            chunks_text,
            http,
            base_url=runtime["base_url"],
            api_key=runtime["api_key"],
            embedding_model=runtime["embedding_model"],
        )
        stored: list[StoredChunk] = []
        for i, (text, emb) in enumerate(zip(chunks_text, embeddings, strict=True)):
            stored.append(
                StoredChunk(
                    chunk_id=f"{body.source_id}-{i}",
                    source_id=body.source_id,
                    title=body.title or body.source_id,
                    text=text,
                    embedding=emb,
                )
            )
        store.replace_source(
            str(user_id), body.source_id, stored, content_hash=body_hash
        )
        return {"ingested": len(stored), "sourceId": body.source_id}
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"模型服务调用失败: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"RAG ingest 失败: {exc}") from exc


@app.delete("/ingest/{source_id}")
async def delete_source(
    source_id: str,
    user_id: Annotated[UUID, Depends(get_user_id)],
):
    if source_id == "sources":
        raise HTTPException(status_code=404, detail="Not found")
    store.replace_source(str(user_id), source_id, [])
    return {"deleted": source_id}


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    top_k: int | None = Field(None, ge=1, le=20)
    session_id: str | None = Field(None, max_length=64)
    base_url: str | None = Field(None, max_length=500)
    api_key: str | None = Field(None, max_length=500)
    embedding_model: str | None = Field(None, max_length=200)
    chat_model: str | None = Field(None, max_length=200)


class ChatSessionCreate(BaseModel):
    title: str = Field("", max_length=200)


class ChatSessionRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


def _session_id_or_empty(body: ChatRequest) -> str:
    sid = (body.session_id or "").strip()
    return sid


async def _run_chat(
    body: ChatRequest,
    user_id: UUID,
    settings: Settings,
    http: httpx.AsyncClient,
) -> dict[str, object]:
    sid = _session_id_or_empty(body)
    if sid and store.get_chat_session(str(user_id), sid) is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    history = store.get_llm_history(str(user_id), sid) if sid else []

    runtime = _resolve_runtime(
        user_id,
        base_url=body.base_url,
        api_key=body.api_key,
        embedding_model=body.embedding_model,
        chat_model=body.chat_model,
    )
    k = body.top_k or settings.retrieval_top_k
    chunks = store.list_for_user(str(user_id))
    user_msg = body.message.strip()
    if not chunks:
        reply = await chat_completion(
            settings,
            http,
            "知识库中还没有内容。请先在笔记中点击「同步到知识库」。",
            user_msg,
            base_url=runtime["base_url"],
            api_key=runtime["api_key"],
            chat_model=runtime["chat_model"],
            history=history,
        )
        out: dict[str, object] = {"reply": reply, "used_chunks": 0, "sources": []}
        if sid:
            store.append_chat_exchange(str(user_id), sid, user_msg, reply)
        return out

    query_emb = (
        await embed_texts_with_runtime(
            settings,
            [user_msg],
            http,
            base_url=runtime["base_url"],
            api_key=runtime["api_key"],
            embedding_model=runtime["embedding_model"],
        )
    )[0]
    scored = sorted(
        ((cosine_sim(query_emb, c.embedding), c) for c in chunks),
        key=lambda x: x[0],
        reverse=True,
    )[:k]

    blocks = [f"【{s.title}】\n{s.text}" for _, s in scored]
    context = "\n\n---\n\n".join(blocks)
    system = (
        "你是个人笔记知识库助手。只根据下面「参考资料」回答；若资料不足以回答，请明确说不知道，不要编造。\n\n"
        f"参考资料：\n{context}"
    )
    reply = await chat_completion(
        settings,
        http,
        system,
        user_msg,
        base_url=runtime["base_url"],
        api_key=runtime["api_key"],
        chat_model=runtime["chat_model"],
        history=history,
    )
    result: dict[str, object] = {
        "reply": reply,
        "used_chunks": len(scored),
        "sources": list({s.source_id for _, s in scored}),
    }
    if sid:
        store.append_chat_exchange(str(user_id), sid, user_msg, reply)
    return result


@app.get("/chat/sessions")
async def list_chat_sessions(user_id: Annotated[UUID, Depends(get_user_id)]):
    return store.list_chat_sessions(str(user_id))


@app.post("/chat/sessions")
async def create_chat_session(
    body: ChatSessionCreate,
    user_id: Annotated[UUID, Depends(get_user_id)],
):
    return store.create_chat_session(str(user_id), body.title)


@app.get("/chat/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    user_id: Annotated[UUID, Depends(get_user_id)],
):
    detail = store.get_chat_session(str(user_id), session_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return detail


@app.patch("/chat/sessions/{session_id}")
async def rename_chat_session(
    session_id: str,
    body: ChatSessionRename,
    user_id: Annotated[UUID, Depends(get_user_id)],
):
    ok = store.set_chat_session_title(str(user_id), session_id, body.title)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在")
    return store.get_chat_session(str(user_id), session_id)


@app.delete("/chat/sessions/{session_id}")
async def delete_chat_session_route(
    session_id: str,
    user_id: Annotated[UUID, Depends(get_user_id)],
):
    ok = store.delete_chat_session(str(user_id), session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"deleted": session_id}


@app.post("/chat/sessions/{session_id}/clear")
async def clear_chat_session_route(
    session_id: str,
    user_id: Annotated[UUID, Depends(get_user_id)],
):
    ok = store.clear_chat_session_messages(str(user_id), session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"cleared": session_id}


@app.post("/chat")
async def chat(
    body: ChatRequest,
    user_id: Annotated[UUID, Depends(get_user_id)],
    settings: Annotated[Settings, Depends(get_settings)],
    http: Annotated[httpx.AsyncClient, Depends(get_http)],
):
    try:
        return await _run_chat(body, user_id, settings, http)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"模型服务调用失败: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"RAG chat 失败: {exc}") from exc


@app.post("/chat/stream")
async def chat_stream(
    body: ChatRequest,
    user_id: Annotated[UUID, Depends(get_user_id)],
    settings: Annotated[Settings, Depends(get_settings)],
    http: Annotated[httpx.AsyncClient, Depends(get_http)],
):
    async def event_gen():
        try:
            result = await _run_chat(body, user_id, settings, http)
            reply = str(result.get("reply", ""))
            used_chunks = int(result.get("used_chunks", 0))
            sources = result.get("sources", [])
            yield "data: " + json.dumps(
                {"type": "meta", "used_chunks": used_chunks, "sources": sources},
                ensure_ascii=False,
            ) + "\n\n"
            step = 18
            for i in range(0, len(reply), step):
                chunk = reply[i : i + step]
                yield "data: " + json.dumps(
                    {"type": "delta", "text": chunk},
                    ensure_ascii=False,
                ) + "\n\n"
                await asyncio.sleep(0.01)
            yield "data: " + json.dumps({"type": "done"}, ensure_ascii=False) + "\n\n"
        except httpx.HTTPError as exc:
            yield "data: " + json.dumps(
                {"type": "error", "message": f"模型服务调用失败: {exc}"},
                ensure_ascii=False,
            ) + "\n\n"
        except Exception as exc:
            yield "data: " + json.dumps(
                {"type": "error", "message": f"RAG chat 失败: {exc}"},
                ensure_ascii=False,
            ) + "\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@app.get("/stats")
async def stats(user_id: Annotated[UUID, Depends(get_user_id)]):
    n = len(store.list_for_user(str(user_id)))
    return {"chunk_count": n}
