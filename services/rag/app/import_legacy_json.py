"""
One-shot: import sibling rag_store.json into SQLite, then delete the JSON file.

  python -m app.import_legacy_json
  python -m app.import_legacy_json --force   # empty DB tables first (destructive)

Uses RAG_STORE_PATH from the environment / .env (see app.config.Settings).
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

from app.config import get_settings
from app.store import (
    _SCHEMA,
    _db_is_empty,
    _migrate_from_json,
    _resolve_paths,
    _wipe_rag_tables,
)


def run_import(*, force: bool = False) -> int:
    settings = get_settings()
    db_path, legacy_json = _resolve_paths(settings.rag_store_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if not legacy_json.is_file():
        print(f"No legacy file: {legacy_json}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.executescript(_SCHEMA)
        if not _db_is_empty(conn) and not force:
            print(
                "SQLite already has RAG data. Re-run with --force to wipe and import JSON "
                "(this deletes all existing RAG rows).",
                file=sys.stderr,
            )
            return 2
        with conn:
            if force:
                _wipe_rag_tables(conn)
            ok = _migrate_from_json(conn, legacy_json)
        if not ok:
            print("Failed to parse or import JSON (file left in place).", file=sys.stderr)
            return 3
        try:
            legacy_json.unlink()
        except OSError as e:
            print(f"Imported OK but could not delete JSON: {e}", file=sys.stderr)
            return 4
        print(f"Imported into {db_path} and removed {legacy_json}")
        return 0
    finally:
        conn.close()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--force",
        action="store_true",
        help="Delete all rows in rag_* tables before import (use if DB is non-empty).",
    )
    args = p.parse_args()
    raise SystemExit(run_import(force=args.force))


if __name__ == "__main__":
    main()
