# Architecture

## Layout

| Path | Role |
|------|------|
| `apps/web` | React (Vite + TypeScript), PWA-oriented UI |
| `services/api` | Spring Boot — auth, notes CRUD, folders/tags, exports |
| `services/rag` | FastAPI — chunking, embeddings, vector store, OpenAI-compatible chat |
| `deploy/` | `docker-compose` + nginx gateway |

## Traffic

- **Local dev (recommended):** Vite dev server proxies `/api` → Java (`:8080`) and `/rag` → Python (`:8000`).
- **Docker:** Browser hits gateway `:8080`; nginx forwards `/api/*` to the API container and strips `/rag` prefix before the RAG container.

## Next steps (implementation)

- Persist notes in Java (e.g. JPA + PostgreSQL) with `user_id` on all rows.
- Issue JWT from Java; validate on protected routes. Either expose RAG only on the internal network and proxy through Java, or validate the same JWT in Python.
- On note changes, call RAG ingest (async job or outbox) so the knowledge base stays in sync.
