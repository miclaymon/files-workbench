import asyncio
import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from lib.blacklist import is_excluded, parse_exclude_param
from lib.fs_ops import (
    stat_path,
    simple_list_dir,
    preview_file,
    open_with_system,
    create_file,
    create_dir,
    write_file,
)

router = APIRouter(prefix="/_api/v1")
_executor = ThreadPoolExecutor(max_workers=16)

_PREFS_DIR = Path(__file__).parent.parent.parent.parent / "config" / "preferences"
_DEFAULT_MAX_PREVIEW_BYTES = 10_000


def _load_max_preview_bytes() -> int:
    try:
        defaults = json.loads((_PREFS_DIR / "default-preferences.json").read_text())
        user_path = _PREFS_DIR / "user-preferences.json"
        user = json.loads(user_path.read_text()) if user_path.exists() else {}
        return (
            user.get("preview", {}).get("maxPreviewBytes")
            or defaults.get("preview", {}).get("maxPreviewBytes")
            or _DEFAULT_MAX_PREVIEW_BYTES
        )
    except Exception:
        return _DEFAULT_MAX_PREVIEW_BYTES


async def _run(fn, *args, timeout: float = 15.0):
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_executor, fn, *args),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Operation timed out")


def _safe_path(p: str) -> Path:
    return Path(p)


def _check(path: Path, *, must_exist: bool = True, not_blacklisted: bool = True):
    if not_blacklisted and is_excluded(path):
        raise HTTPException(status_code=403, detail="Path is blacklisted")
    if must_exist and not path.exists():
        raise HTTPException(status_code=404, detail=f"Not found: {path}")


# ── app ───────────────────────────────────────────────────────────────────────

@router.get("/app/init")
async def app_init():
    home = os.environ.get("USERPROFILE") or str(Path.home())
    return {"homePath": home}


# ── fs reads ──────────────────────────────────────────────────────────────────

@router.get("/fs/stat")
async def fs_stat(path: str = Query(...)):
    p = _safe_path(path)
    _check(p)
    return await _run(stat_path, p)


@router.get("/fs/list_dir")
async def fs_list_dir(
    path: str = Query(...),
    includeMetadata: bool = Query(default=True),
    showHidden: bool = Query(default=True),
    excludeCategories: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=0, ge=0),
):
    p = _safe_path(path)
    _check(p)
    if not p.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory")
    excluded_cats = parse_exclude_param(excludeCategories)
    items = await _run(lambda: simple_list_dir(p, excluded_cats, includeMetadata, showHidden))
    total = len(items)
    page = items[offset : offset + limit] if limit > 0 else items[offset:]
    return JSONResponse(
        {"items": page, "total": total, "offset": offset},
        headers={"Cache-Control": "no-store", "Expires": "0"},
    )


@router.get("/fs/preview")
async def fs_preview(path: str = Query(...), force: bool = Query(default=False)):
    p = _safe_path(path)
    _check(p)
    max_bytes = _load_max_preview_bytes()
    file_size = p.stat().st_size if p.is_file() else 0
    if not force and file_size > max_bytes and not p.is_dir():
        import mimetypes
        mime, _ = mimetypes.guess_type(str(p))
        mime = mime or "application/octet-stream"
        if not mime.startswith("image/") and not mime.startswith("video/") and not mime.startswith("audio/"):
            return JSONResponse({"kind": "tooLarge", "fileSize": file_size, "maxBytes": max_bytes})
    return await _run(lambda: preview_file(p, max_bytes if not force else file_size + 1))


# ── fs writes ─────────────────────────────────────────────────────────────────

class PathBody(BaseModel):
    path: str


class CreateDirBody(BaseModel):
    path: str


class WriteFileBody(BaseModel):
    path: str
    content: str


@router.post("/fs/open_with_system")
async def fs_open_with_system(body: PathBody):
    p = _safe_path(body.path)
    _check(p)
    await _run(open_with_system, p)
    return {"path": str(p)}


@router.post("/fs/create_file")
async def fs_create_file(body: PathBody):
    p = _safe_path(body.path)
    _check(p, must_exist=False)
    if p.exists():
        raise HTTPException(status_code=409, detail="Already exists")
    await _run(create_file, p)
    return {"path": str(p)}


@router.post("/fs/create_dir")
async def fs_create_dir(body: CreateDirBody):
    p = _safe_path(body.path)
    _check(p, must_exist=False)
    if p.exists():
        raise HTTPException(status_code=409, detail="Already exists")
    await _run(create_dir, p)
    return {"path": str(p)}


@router.post("/fs/write_file")
async def fs_write_file(body: WriteFileBody):
    p = _safe_path(body.path)
    _check(p, must_exist=False)
    await _run(write_file, p, body.content)
    return {"path": str(p)}
