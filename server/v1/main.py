import asyncio
import json
import logging
import sys
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from lib import cache as _cache
from routers import explorer as explorer_router
from routers import fs as fs_router
from routers import media as media_router
from routers import perf as perf_router
from routers import preferences as preferences_router

_log_dir = Path(__file__).parent.parent / "logs"
_log_dir.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(_log_dir / "server.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("server")

class _AccessLogMiddleware:
    """Pure ASGI middleware — intercepts send() so it never touches the response body."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        t0 = time.perf_counter()
        status_code = 0
        total_bytes = 0

        async def send_wrapper(message):
            nonlocal status_code, total_bytes
            if message["type"] == "http.response.start":
                status_code = message["status"]
            elif message["type"] == "http.response.body":
                total_bytes += len(message.get("body", b""))
            await send(message)  # send first, log after
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                elapsed_ms = (time.perf_counter() - t0) * 1000
                method = scope.get("method", "?")
                path = scope.get("path", "?")
                query = scope.get("query_string", b"").decode()
                full_path = f"{path}?{query}" if query else path
                cache_tag = f"  [{_cache.request_cache_status()}]" if _cache.request_cache_status() else ""
                # Run in executor so file I/O never blocks the event loop
                asyncio.get_running_loop().run_in_executor(
                    None, log.info, "%s %s → %d%s  %.0fms  %db",
                    method, full_path, status_code, cache_tag, elapsed_ms, total_bytes,
                )

        await self.app(scope, receive, send_wrapper)


app = FastAPI(title="Files Workbench API", version="1.0.0")
app.add_middleware(_AccessLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(explorer_router.router)
app.include_router(fs_router.router)
app.include_router(media_router.router, prefix="/_api/v1/media")
app.include_router(perf_router.router)
app.include_router(preferences_router.router)


@app.on_event("startup")
async def _startup():
    import os as _os
    from lib import cache as _response_cache
    from lib.media_ops import enforce_thumb_quota, thumb_cache_size_bytes

    if sys.platform == "win32":
        base = Path(_os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Caches"
    else:
        base = Path(_os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache"))
    cache_dir = base / "files-workbench"
    cache_dir.mkdir(parents=True, exist_ok=True)

    _response_cache.init(cache_dir / "cache.db")

    loop = asyncio.get_running_loop()
    evicted = await loop.run_in_executor(None, _response_cache.evict_expired)
    log.info("Cache DB ready, evicted %d expired entries", evicted)

    # Read cache quota from prefs
    try:
        prefs_dir = Path(__file__).parent.parent / "config" / "preferences"
        defaults = json.loads((prefs_dir / "default-preferences.json").read_text())
        user_path = prefs_dir / "user-preferences.json"
        user = json.loads(user_path.read_text()) if user_path.exists() else {}
        max_mb = (user.get("cache", {}).get("maxSizeMb") or defaults.get("cache", {}).get("maxSizeMb") or 500)
    except Exception:
        max_mb = 500

    max_bytes = max_mb * 1024 * 1024
    # ~10% of quota for response cache, rest for thumbnails
    await loop.run_in_executor(None, _response_cache.trim, max_bytes // 10)
    await loop.run_in_executor(None, enforce_thumb_quota, max_bytes - max_bytes // 10)
    log.info("Cache quota %d MB enforced (thumb dir: %d bytes)", max_mb, thumb_cache_size_bytes())


@app.get("/health")
async def health():
    return {"status": "ok"}
