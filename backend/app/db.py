"""SQLite persistence keyed by the anonymous `user_id` (see identity.py). JSON columns hold nested data."""

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    profile_image_url TEXT NOT NULL DEFAULT '',
    preferences_json TEXT NOT NULL DEFAULT '{}',
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_json TEXT NOT NULL,
    overall_json TEXT NOT NULL,
    preference_breakdown_json TEXT NOT NULL,
    recall_check_json TEXT NOT NULL,
    sources_json TEXT NOT NULL,
    data_gaps_json TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scan_records (user_id, created_at DESC);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@contextmanager
def connect(path: str | None = None) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(path or settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(path: str | None = None) -> None:
    with connect(path) as conn:
        conn.executescript(SCHEMA)


# ---- profiles -------------------------------------------------------------

def _profile_from_row(row: sqlite3.Row) -> dict:
    return {
        "user_id": row["user_id"],
        "display_name": row["display_name"],
        "email": row["email"],
        "phone": row["phone"],
        "profile_image_url": row["profile_image_url"],
        "preferences": json.loads(row["preferences_json"]),
        "onboarding_completed": bool(row["onboarding_completed"]),
        "updated_at": row["updated_at"],
    }


def get_profile(user_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()
    return _profile_from_row(row) if row else None


def ensure_profile(user_id: str) -> None:
    """Create an empty profile the first time an ID is seen (no-op afterwards)."""
    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO user_profiles (user_id, updated_at) VALUES (?, ?)", (user_id, now_iso()))


def update_profile(user_id: str, fields: dict) -> dict:
    columns = {
        "display_name": "display_name",
        "email": "email",
        "phone": "phone",
        "profile_image_url": "profile_image_url",
        "onboarding_completed": "onboarding_completed",
        "preferences": "preferences_json",
    }
    sets, values = [], []
    for key, column in columns.items():
        if key in fields and fields[key] is not None:
            value = fields[key]
            if key == "preferences":
                value = json.dumps(value)
            elif key == "onboarding_completed":
                value = int(bool(value))
            sets.append(f"{column} = ?")
            values.append(value)
    sets.append("updated_at = ?")
    values.append(now_iso())
    with connect() as conn:
        conn.execute(f"UPDATE user_profiles SET {', '.join(sets)} WHERE user_id = ?", (*values, user_id))
    return get_profile(user_id)  # type: ignore[return-value]


# ---- scans ----------------------------------------------------------------

def _scan_from_row(row: sqlite3.Row) -> dict:
    return {
        "scan_id": row["id"],
        "product": json.loads(row["product_json"]),
        "overall_result": json.loads(row["overall_json"]),
        "preference_breakdown": json.loads(row["preference_breakdown_json"]),
        "recall_check": json.loads(row["recall_check_json"]),
        "sources": json.loads(row["sources_json"]),
        "data_gaps": json.loads(row["data_gaps_json"]),
        "is_demo": bool(row["is_demo"]),
        "created_at": row["created_at"],
    }


def save_scan(user_id: str, scan: dict) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO scan_records (id, user_id, product_json, overall_json, preference_breakdown_json,"
            " recall_check_json, sources_json, data_gaps_json, is_demo, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                scan["scan_id"],
                user_id,
                json.dumps(scan["product"]),
                json.dumps(scan["overall_result"]),
                json.dumps(scan["preference_breakdown"]),
                json.dumps(scan["recall_check"]),
                json.dumps(scan["sources"]),
                json.dumps(scan["data_gaps"]),
                int(scan.get("is_demo", False)),
                scan["created_at"],
            ),
        )


def list_scans(user_id: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM scan_records WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
    return [_scan_from_row(r) for r in rows]


def get_scan(user_id: str, scan_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM scan_records WHERE id = ? AND user_id = ?", (scan_id, user_id)
        ).fetchone()
    return _scan_from_row(row) if row else None


def delete_scans(user_id: str) -> int:
    with connect() as conn:
        cur = conn.execute("DELETE FROM scan_records WHERE user_id = ?", (user_id,))
        return cur.rowcount
