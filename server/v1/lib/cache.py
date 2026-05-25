"""SQLite-backed response cache (best-effort, never fatal).

Uses threading.local() for per-thread connections with WAL mode.
Stores data at ~/.cache/files-workbench/cache.db (or platform equivalent).
"""
import hashlib
import json
import sqlite3
import threading
import time
from contextvars import ContextVar
from pathlib import Path

# Per-request cache status, isolated per asyncio task.
# Values: 'HIT', 'MISS', or '' (endpoint doesn't use cache).
_req_status: ContextVar[str] = ContextVar("cache_req_status", default="")

_local = threading.local()
_db_path: Path | None = None
_initialized = False

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS cache (
    key     TEXT PRIMARY KEY,
    data    TEXT NOT NULL,
    created REAL NOT NULL,
    expires REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expires ON cache (expires);
"""


def _conn() -> sqlite3.Connection | None:
    """Return a per-thread SQLite connection, or None if not yet initialised."""
    if not _initialized:
        return None
    try:
        if not hasattr(_local, "conn") or _local.conn is None:
            con = sqlite3.connect(str(_db_path), check_same_thread=False)
            con.execute("PRAGMA journal_mode=WAL")
            con.execute("PRAGMA synchronous=NORMAL")
            _local.conn = con
        return _local.conn
    except Exception:
        return None


def init(db_path: Path) -> None:
    """Create table (if not exists) and mark the module as ready."""
    global _db_path, _initialized
    try:
        _db_path = db_path
        con = sqlite3.connect(str(db_path), check_same_thread=False)
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA synchronous=NORMAL")
        con.executescript(_CREATE_TABLE)
        con.close()
        _initialized = True
    except Exception:
        pass


def make_key(*parts) -> str:
    """SHA-1 of NUL-joined string parts."""
    raw = "\x00".join(str(p) for p in parts)
    return hashlib.sha1(raw.encode()).hexdigest()


def request_cache_status() -> str:
    """Return the cache status set during this request ('HIT', 'MISS', or '')."""
    return _req_status.get()


def get(key: str) -> dict | None:
    """Return cached value or None if missing / expired / error."""
    try:
        con = _conn()
        if con is None:
            _req_status.set("MISS")
            return None
        now = time.time()
        row = con.execute(
            "SELECT data FROM cache WHERE key = ? AND expires > ?", (key, now)
        ).fetchone()
        if row is None:
            _req_status.set("MISS")
            return None
        _req_status.set("HIT")
        return json.loads(row[0])
    except Exception:
        return None


def put(key: str, value, ttl: int) -> None:
    """Store value under key with a TTL in seconds. Silent on error."""
    try:
        con = _conn()
        if con is None:
            return
        now = time.time()
        data = json.dumps(value)
        con.execute(
            "INSERT OR REPLACE INTO cache (key, data, created, expires) VALUES (?, ?, ?, ?)",
            (key, data, now, now + ttl),
        )
        con.commit()
    except Exception:
        pass


def evict_expired() -> int:
    """Delete all expired rows. Returns count of deleted rows."""
    try:
        con = _conn()
        if con is None:
            return 0
        cur = con.execute("DELETE FROM cache WHERE expires <= ?", (time.time(),))
        con.commit()
        return cur.rowcount
    except Exception:
        return 0


def db_size_bytes() -> int:
    """Return the size of the DB file in bytes."""
    try:
        if _db_path is None:
            return 0
        return _db_path.stat().st_size
    except Exception:
        return 0


def trim(max_bytes: int) -> None:
    """If DB exceeds max_bytes, delete oldest 25% of rows then VACUUM."""
    try:
        if db_size_bytes() <= max_bytes:
            return
        con = _conn()
        if con is None:
            return
        total = con.execute("SELECT COUNT(*) FROM cache").fetchone()[0]
        to_delete = max(1, total // 4)
        con.execute(
            "DELETE FROM cache WHERE key IN "
            "(SELECT key FROM cache ORDER BY created ASC LIMIT ?)",
            (to_delete,),
        )
        con.commit()
        con.execute("VACUUM")
    except Exception:
        pass
