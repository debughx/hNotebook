import json
import sqlite3
import struct
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class StoredChunk:
    chunk_id: str
    source_id: str
    title: str
    text: str
    embedding: list[float]


DEFAULT_CHAT_TITLE = "新对话"
_MAX_TITLE_LEN = 200
_MAX_LLM_HISTORY_MESSAGES = 24

_SCHEMA = """
CREATE TABLE IF NOT EXISTS rag_user_runtime (
  user_id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  embedding_model TEXT NOT NULL DEFAULT '',
  chat_model TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  user_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB NOT NULL,
  PRIMARY KEY (user_id, chunk_id)
);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_source ON rag_chunks(user_id, source_id);

CREATE TABLE IF NOT EXISTS rag_source_meta (
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  ingested_at TEXT NOT NULL,
  PRIMARY KEY (user_id, source_id)
);

CREATE TABLE IF NOT EXISTS rag_chat_sessions (
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, session_id)
);

CREATE TABLE IF NOT EXISTS rag_chat_messages (
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, session_id, message_id),
  UNIQUE (user_id, session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_rag_msgs_session_seq ON rag_chat_messages(user_id, session_id, seq);
"""


def _resolve_paths(config_path: str) -> tuple[Path, Path]:
    """DB path is always *.db; legacy JSON is sibling *.json for one-time import."""
    p = Path(config_path)
    if p.suffix.lower() == ".json":
        return p.with_suffix(".db"), p
    return p, p.with_suffix(".json")


def _pack_embedding(vec: list[float]) -> bytes:
    return struct.pack(f"{len(vec)}f", *vec)


def _unpack_embedding(blob: bytes) -> list[float]:
    if not blob or len(blob) % 4 != 0:
        return []
    n = len(blob) // 4
    return list(struct.unpack(f"{n}f", blob))


def _db_is_empty(conn: sqlite3.Connection) -> bool:
    for table in ("rag_chunks", "rag_chat_sessions", "rag_chat_messages", "rag_user_runtime"):
        n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        if n > 0:
            return False
    return True


def _backfill_source_meta_from_chunks(conn: sqlite3.Connection) -> None:
    """Rows for chunk groups without meta (e.g. legacy data); content_hash stays empty."""
    conn.execute(
        """
        INSERT OR IGNORE INTO rag_source_meta (user_id, source_id, chunk_count, content_hash, ingested_at)
        SELECT user_id, source_id, COUNT(*), '', ''
        FROM rag_chunks
        GROUP BY user_id, source_id
        """
    )


def _migrate_from_json(conn: sqlite3.Connection, json_path: Path) -> bool:
    """Parse legacy JSON and upsert into DB. Returns False if file unreadable or not a dict."""
    try:
        raw = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    if not isinstance(raw, dict):
        return False
    for user_id, payload in raw.items():
        uid = str(user_id)
        if not isinstance(payload, dict):
            continue
        base_url = str(payload.get("base_url", "") or "")
        api_key = str(payload.get("api_key", "") or "")
        embedding_model = str(payload.get("embedding_model", "") or "")
        chat_model = str(payload.get("chat_model", "") or "")
        conn.execute(
            """
            INSERT INTO rag_user_runtime (user_id, base_url, api_key, embedding_model, chat_model)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              base_url=excluded.base_url,
              api_key=excluded.api_key,
              embedding_model=excluded.embedding_model,
              chat_model=excluded.chat_model
            """,
            (uid, base_url, api_key, embedding_model, chat_model),
        )
        for c in payload.get("chunks", []) or []:
            if not isinstance(c, dict):
                continue
            try:
                emb = [float(v) for v in c["embedding"]]
                conn.execute(
                    """
                    INSERT OR REPLACE INTO rag_chunks
                    (user_id, chunk_id, source_id, title, text, embedding)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        uid,
                        str(c["chunk_id"]),
                        str(c["source_id"]),
                        str(c.get("title", "")),
                        str(c.get("text", "")),
                        _pack_embedding(emb),
                    ),
                )
            except Exception:
                continue
        for s in payload.get("chat_sessions", []) or []:
            if not isinstance(s, dict):
                continue
            sid = str(s.get("id", "") or "")
            if not sid:
                continue
            title = str(s.get("title", "") or DEFAULT_CHAT_TITLE)[:_MAX_TITLE_LEN]
            updated_at = str(s.get("updated_at", "") or _utc_now_iso())
            conn.execute(
                """
                INSERT OR REPLACE INTO rag_chat_sessions (user_id, session_id, title, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (uid, sid, title, updated_at),
            )
            seq = 0
            for m in s.get("messages", []) or []:
                if not isinstance(m, dict):
                    continue
                mid = str(m.get("id", "") or "")
                role = str(m.get("role", "") or "")
                content = str(m.get("content", "") or "")
                if not mid or role not in ("user", "assistant", "system"):
                    continue
                conn.execute(
                    """
                    INSERT OR REPLACE INTO rag_chat_messages
                    (user_id, session_id, message_id, role, content, seq)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (uid, sid, mid, role, content, seq),
                )
                seq += 1
    return True


def _wipe_rag_tables(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM rag_chat_messages")
    conn.execute("DELETE FROM rag_chat_sessions")
    conn.execute("DELETE FROM rag_source_meta")
    conn.execute("DELETE FROM rag_chunks")
    conn.execute("DELETE FROM rag_user_runtime")


class VectorStore:
    """Per-user RAG data in SQLite (WAL). Embeddings stored as float32 BLOB."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._conn: sqlite3.Connection | None = None
        self._db_path: Path | None = None

    def configure(self, path: str) -> None:
        with self._lock:
            if self._conn is not None:
                try:
                    self._conn.close()
                except Exception:
                    pass
                self._conn = None
            db_path, legacy_json = _resolve_paths(path)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(str(db_path), check_same_thread=False)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            migrated_ok = False
            with conn:
                conn.executescript(_SCHEMA)
                if legacy_json.exists() and _db_is_empty(conn):
                    try:
                        migrated_ok = bool(_migrate_from_json(conn, legacy_json))
                    except Exception:
                        migrated_ok = False
                _backfill_source_meta_from_chunks(conn)
            if migrated_ok and legacy_json.exists():
                try:
                    legacy_json.unlink()
                except OSError:
                    pass
            self._conn = conn
            self._db_path = db_path

    def _c(self) -> sqlite3.Connection:
        if self._conn is None:
            raise RuntimeError("VectorStore not configured")
        return self._conn

    def clear_user(self, user_id: str) -> None:
        with self._lock:
            c = self._c()
            with c:
                c.execute("DELETE FROM rag_chat_messages WHERE user_id=?", (user_id,))
                c.execute("DELETE FROM rag_chat_sessions WHERE user_id=?", (user_id,))
                c.execute("DELETE FROM rag_source_meta WHERE user_id=?", (user_id,))
                c.execute("DELETE FROM rag_chunks WHERE user_id=?", (user_id,))
                c.execute("DELETE FROM rag_user_runtime WHERE user_id=?", (user_id,))

    def add_chunks(self, user_id: str, chunks: list[StoredChunk]) -> None:
        if not chunks:
            return
        with self._lock:
            c = self._c()
            with c:
                for ch in chunks:
                    c.execute(
                        """
                        INSERT OR REPLACE INTO rag_chunks
                        (user_id, chunk_id, source_id, title, text, embedding)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            user_id,
                            ch.chunk_id,
                            ch.source_id,
                            ch.title,
                            ch.text,
                            _pack_embedding(ch.embedding),
                        ),
                    )

    def replace_source(
        self,
        user_id: str,
        source_id: str,
        new_chunks: list[StoredChunk],
        *,
        content_hash: str | None = None,
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            c = self._c()
            with c:
                c.execute(
                    "DELETE FROM rag_chunks WHERE user_id=? AND source_id=?",
                    (user_id, source_id),
                )
                if not new_chunks:
                    c.execute(
                        "DELETE FROM rag_source_meta WHERE user_id=? AND source_id=?",
                        (user_id, source_id),
                    )
                    return
                for ch in new_chunks:
                    c.execute(
                        """
                        INSERT INTO rag_chunks (user_id, chunk_id, source_id, title, text, embedding)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            user_id,
                            ch.chunk_id,
                            ch.source_id,
                            ch.title,
                            ch.text,
                            _pack_embedding(ch.embedding),
                        ),
                    )
                h = content_hash if content_hash is not None else ""
                c.execute(
                    """
                    INSERT INTO rag_source_meta (user_id, source_id, chunk_count, content_hash, ingested_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, source_id) DO UPDATE SET
                      chunk_count=excluded.chunk_count,
                      content_hash=excluded.content_hash,
                      ingested_at=excluded.ingested_at
                    """,
                    (user_id, source_id, len(new_chunks), h, now),
                )

    def list_ingested_sources(self, user_id: str) -> list[dict[str, object]]:
        with self._lock:
            rows = self._c().execute(
                """
                SELECT source_id, chunk_count, content_hash, ingested_at
                FROM rag_source_meta
                WHERE user_id=?
                ORDER BY ingested_at DESC
                """,
                (user_id,),
            ).fetchall()
        return [
            {
                "source_id": str(r[0]),
                "chunk_count": int(r[1]),
                "content_hash": str(r[2] or ""),
                "ingested_at": str(r[3] or ""),
            }
            for r in rows
        ]

    def list_for_user(self, user_id: str) -> list[StoredChunk]:
        with self._lock:
            rows = self._c().execute(
                """
                SELECT chunk_id, source_id, title, text, embedding
                FROM rag_chunks WHERE user_id=?
                """,
                (user_id,),
            ).fetchall()
        out: list[StoredChunk] = []
        for chunk_id, src, title, text, emb_blob in rows:
            emb = _unpack_embedding(emb_blob)
            if not emb:
                continue
            out.append(
                StoredChunk(
                    chunk_id=str(chunk_id),
                    source_id=str(src),
                    title=str(title),
                    text=str(text),
                    embedding=emb,
                )
            )
        return out

    def get_runtime_config(self, user_id: str) -> dict[str, str]:
        with self._lock:
            row = self._c().execute(
                """
                SELECT base_url, api_key, embedding_model, chat_model
                FROM rag_user_runtime WHERE user_id=?
                """,
                (user_id,),
            ).fetchone()
        if not row:
            return {
                "base_url": "",
                "api_key": "",
                "embedding_model": "",
                "chat_model": "",
            }
        return {
            "base_url": str(row[0] or ""),
            "api_key": str(row[1] or ""),
            "embedding_model": str(row[2] or ""),
            "chat_model": str(row[3] or ""),
        }

    def set_runtime_config(
        self,
        user_id: str,
        *,
        base_url: str,
        api_key: str,
        embedding_model: str,
        chat_model: str,
    ) -> None:
        with self._lock:
            c = self._c()
            with c:
                c.execute(
                    """
                    INSERT INTO rag_user_runtime (user_id, base_url, api_key, embedding_model, chat_model)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                      base_url=excluded.base_url,
                      api_key=excluded.api_key,
                      embedding_model=excluded.embedding_model,
                      chat_model=excluded.chat_model
                    """,
                    (user_id, base_url, api_key, embedding_model, chat_model),
                )

    def list_chat_sessions(self, user_id: str) -> list[dict[str, object]]:
        with self._lock:
            rows = self._c().execute(
                """
                SELECT s.session_id, s.title, s.updated_at,
                  (SELECT COUNT(*) FROM rag_chat_messages m
                   WHERE m.user_id=s.user_id AND m.session_id=s.session_id) AS message_count
                FROM rag_chat_sessions s
                WHERE s.user_id=?
                ORDER BY s.updated_at DESC
                """,
                (user_id,),
            ).fetchall()
        return [
            {
                "id": str(r[0]),
                "title": str(r[1]),
                "updated_at": str(r[2]),
                "message_count": int(r[3]),
            }
            for r in rows
        ]

    def get_chat_session(self, user_id: str, session_id: str) -> dict[str, object] | None:
        with self._lock:
            c = self._c()
            srow = c.execute(
                """
                SELECT session_id, title, updated_at FROM rag_chat_sessions
                WHERE user_id=? AND session_id=?
                """,
                (user_id, session_id),
            ).fetchone()
            if not srow:
                return None
            mrows = c.execute(
                """
                SELECT message_id, role, content FROM rag_chat_messages
                WHERE user_id=? AND session_id=?
                ORDER BY seq ASC
                """,
                (user_id, session_id),
            ).fetchall()
        messages = [
            {"id": str(m[0]), "role": str(m[1]), "content": str(m[2])} for m in mrows
        ]
        return {
            "id": str(srow[0]),
            "title": str(srow[1]),
            "updated_at": str(srow[2]),
            "message_count": len(messages),
            "messages": messages,
        }

    def create_chat_session(self, user_id: str, title: str = "") -> dict[str, object]:
        sid = str(uuid.uuid4())
        now = _utc_now_iso()
        t = (title.strip() or DEFAULT_CHAT_TITLE)[:_MAX_TITLE_LEN]
        with self._lock:
            c = self._c()
            with c:
                c.execute(
                    """
                    INSERT INTO rag_chat_sessions (user_id, session_id, title, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (user_id, sid, t, now),
                )
        return {
            "id": sid,
            "title": t,
            "updated_at": now,
            "message_count": 0,
        }

    def set_chat_session_title(self, user_id: str, session_id: str, title: str) -> bool:
        t = (title.strip() or DEFAULT_CHAT_TITLE)[:_MAX_TITLE_LEN]
        now = _utc_now_iso()
        with self._lock:
            c = self._c()
            with c:
                cur = c.execute(
                    """
                    UPDATE rag_chat_sessions SET title=?, updated_at=?
                    WHERE user_id=? AND session_id=?
                    """,
                    (t, now, user_id, session_id),
                )
                return cur.rowcount > 0

    def delete_chat_session(self, user_id: str, session_id: str) -> bool:
        with self._lock:
            c = self._c()
            with c:
                c.execute(
                    "DELETE FROM rag_chat_messages WHERE user_id=? AND session_id=?",
                    (user_id, session_id),
                )
                cur = c.execute(
                    "DELETE FROM rag_chat_sessions WHERE user_id=? AND session_id=?",
                    (user_id, session_id),
                )
                return cur.rowcount > 0

    def clear_chat_session_messages(self, user_id: str, session_id: str) -> bool:
        now = _utc_now_iso()
        with self._lock:
            c = self._c()
            with c:
                c.execute(
                    "DELETE FROM rag_chat_messages WHERE user_id=? AND session_id=?",
                    (user_id, session_id),
                )
                u = c.execute(
                    """
                    UPDATE rag_chat_sessions SET updated_at=?
                    WHERE user_id=? AND session_id=?
                    """,
                    (now, user_id, session_id),
                )
                return u.rowcount > 0

    def get_llm_history(self, user_id: str, session_id: str) -> list[dict[str, str]]:
        with self._lock:
            rows = self._c().execute(
                """
                SELECT role, content FROM rag_chat_messages
                WHERE user_id=? AND session_id=?
                ORDER BY seq ASC
                """,
                (user_id, session_id),
            ).fetchall()
        hist: list[dict[str, str]] = []
        for role, content in rows:
            r = str(role)
            if r in ("user", "assistant"):
                hist.append({"role": r, "content": str(content)})
        if len(hist) > _MAX_LLM_HISTORY_MESSAGES:
            hist = hist[-_MAX_LLM_HISTORY_MESSAGES :]
        return hist

    def append_chat_exchange(
        self,
        user_id: str,
        session_id: str,
        user_content: str,
        assistant_content: str,
    ) -> bool:
        now = _utc_now_iso()
        uid_msg = str(uuid.uuid4())
        aid_msg = str(uuid.uuid4())
        with self._lock:
            c = self._c()
            with c:
                srow = c.execute(
                    "SELECT title FROM rag_chat_sessions WHERE user_id=? AND session_id=?",
                    (user_id, session_id),
                ).fetchone()
                if not srow:
                    return False
                current_title = str(srow[0] or DEFAULT_CHAT_TITLE)
                row = c.execute(
                    """
                    SELECT COALESCE(MAX(seq), -1) FROM rag_chat_messages
                    WHERE user_id=? AND session_id=?
                    """,
                    (user_id, session_id),
                ).fetchone()
                next_seq = int(row[0]) + 1
                c.execute(
                    """
                    INSERT INTO rag_chat_messages
                    (user_id, session_id, message_id, role, content, seq)
                    VALUES (?, ?, ?, 'user', ?, ?)
                    """,
                    (user_id, session_id, uid_msg, user_content, next_seq),
                )
                c.execute(
                    """
                    INSERT INTO rag_chat_messages
                    (user_id, session_id, message_id, role, content, seq)
                    VALUES (?, ?, ?, 'assistant', ?, ?)
                    """,
                    (user_id, session_id, aid_msg, assistant_content, next_seq + 1),
                )
                new_title = current_title
                if current_title == DEFAULT_CHAT_TITLE and user_content.strip():
                    snippet = user_content.strip().replace("\n", " ")
                    new_title = (snippet[:40] + ("…" if len(snippet) > 40 else ""))[
                        :_MAX_TITLE_LEN
                    ]
                c.execute(
                    """
                    UPDATE rag_chat_sessions SET title=?, updated_at=?
                    WHERE user_id=? AND session_id=?
                    """,
                    (new_title, now, user_id, session_id),
                )
                return True


store = VectorStore()
