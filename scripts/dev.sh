#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "hNotebook — run each command in a separate terminal, or use Docker (see docs/local-dev.md)."
echo ""
echo "1) API:"
echo "   cd \"$ROOT/services/api\" && mvn spring-boot:run"
echo ""
echo "2) RAG:"
echo "   cd \"$ROOT/services/rag\" && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
echo ""
echo "3) Web:"
echo "   cd \"$ROOT/apps/web\" && npm install && npm run dev"
echo ""
