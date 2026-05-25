import asyncio
import json
import os
import sys
import logging
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from lib.blacklist import is_excluded, parse_exclude_param, get_all_categories, get_rules
from lib.fs_ops import explorer_query, make_item_info, windows_drives
from lib import cache as _cache

log = logging.getLogger("server")
router = APIRouter(prefix="/_api/v1/Explorer")

_PREFS_DIR = Path(__file__).parent.parent.parent.parent / "config" / "preferences"


def _load_explorer_show_files() -> bool:
    """Read showFiles preference from merged defaults + user config."""
    try:
        defaults = json.loads((_PREFS_DIR / "default-preferences.json").read_text())
        user_path = _PREFS_DIR / "user-preferences.json"
        user = json.loads(user_path.read_text()) if user_path.exists() else {}
        return (
            user.get("explorer", {}).get("showFiles")
            if user.get("explorer", {}).get("showFiles") is not None
            else defaults.get("explorer", {}).get("showFiles", False)
        )
    except Exception:
        return False


def _type_filter(show_files: bool, include_drives: bool = False) -> str:
    base = "directory,symlink,file" if show_files else "directory,symlink"
    if include_drives:
        return "drive," + base
    return base
_executor = ThreadPoolExecutor(max_workers=16)

_DRIVES_ROOT = {
    "name": "Drives", "path": None, "type": "drive",
    "hidden": False, "icon": None, "uri": None,
    "size": None, "date_created": None, "date_modified": None, "date_accessed": None,
}


async def _run(fn, *args, timeout: float = 15.0):
    """Run blocking fn in the executor with a hard timeout."""
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_executor, fn, *args),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        log.warning("explorer_query timed out after %.1fs", timeout)
        raise


@router.get("/categories")
async def api_explorer_categories():
    """List all available blacklist categories and their rules."""
    return {"categories": get_all_categories(), "rules": get_rules()}


@router.get("")
async def api_explorer(
    root: Optional[str] = Query(default=None),
    recursive: bool = Query(default=False),
    showHidden: bool = Query(default=True),
    excludeCategories: Optional[str] = Query(default=None),
    includeMetadata: bool = Query(default=True),
):
    if not root:
        root = "/" if os.name != "nt" else None
    if root is None:
        return JSONResponse(status_code=400, content={"detail": "root is required on Windows"})

    path = Path(root)
    if is_excluded(path):
        return JSONResponse(status_code=403, content={"detail": "Path is blacklisted"})
    if not path.exists():
        return JSONResponse(status_code=404, content={"detail": f"Not found: {root}"})
    if not path.is_dir():
        return JSONResponse(status_code=400, content={"detail": f"Not a directory: {root}"})

    show_files = _load_explorer_show_files()
    key = _cache.make_key("explorer", root or "", recursive, showHidden, excludeCategories or "", show_files)
    cached = _cache.get(key)
    if cached is not None:
        return cached

    type_str = _type_filter(show_files)
    excluded_cats = parse_exclude_param(excludeCategories)
    try:
        items, root_item = await _run(lambda: explorer_query(path, type_str, recursive, showHidden, excluded_cats, include_metadata=includeMetadata))
    except asyncio.TimeoutError:
        return JSONResponse(status_code=504, content={"detail": "Directory listing timed out"})
    result = {"root": root_item, "items": items}
    _cache.put(key, result, ttl=15)
    return result


@router.get("/root")
async def api_explorer_root(
    recursive: bool = Query(default=False),
    showHidden: bool = Query(default=True),
    excludeCategories: Optional[str] = Query(default=None),
    includeMetadata: bool = Query(default=False),
):
    if os.name == "nt":
        return JSONResponse(status_code=404, content={"detail": "Not available on Windows"})

    show_files = _load_explorer_show_files()
    key = _cache.make_key("explorer_root", recursive, showHidden, excludeCategories or "", show_files)
    cached = _cache.get(key)
    if cached is not None:
        return cached

    path = Path("/")
    type_str = _type_filter(show_files)
    excluded_cats = parse_exclude_param(excludeCategories)
    try:
        items, _ = await _run(lambda: explorer_query(path, type_str, recursive, showHidden, excluded_cats, include_metadata=includeMetadata))
    except asyncio.TimeoutError:
        return JSONResponse(status_code=504, content={"detail": "Directory listing timed out"})
    root_item = make_item_info(path, force_type="root", name_override="Root")
    result = {"root": root_item, "items": items}
    _cache.put(key, result, ttl=15)
    return result


@router.get("/home")
async def api_explorer_home(
    recursive: bool = Query(default=False),
    showHidden: bool = Query(default=True),
    excludeCategories: Optional[str] = Query(default=None),
    includeMetadata: bool = Query(default=False),
):
    show_files = _load_explorer_show_files()
    key = _cache.make_key("explorer_home", recursive, showHidden, excludeCategories or "", show_files)
    cached = _cache.get(key)
    if cached is not None:
        return cached

    path = Path.home()
    type_str = _type_filter(show_files)
    excluded_cats = parse_exclude_param(excludeCategories)
    try:
        items, root_item = await _run(lambda: explorer_query(path, type_str, recursive, showHidden, excluded_cats, include_metadata=includeMetadata))
    except asyncio.TimeoutError:
        return JSONResponse(status_code=504, content={"detail": "Directory listing timed out"})
    root_item["name"] = "Home"
    result = {"root": root_item, "items": items}
    _cache.put(key, result, ttl=15)
    return result


@router.get("/drives")
async def api_explorer_drives(
    showHidden: bool = Query(default=True),
    excludeCategories: Optional[str] = Query(default=None),
):
    key = _cache.make_key("explorer_drives", showHidden, excludeCategories or "")
    cached = _cache.get(key)
    if cached is not None:
        return cached

    excluded_cats = parse_exclude_param(excludeCategories)

    if os.name == "nt":
        try:
            drives = await _run(windows_drives)
        except asyncio.TimeoutError:
            return JSONResponse(status_code=504, content={"detail": "Drive listing timed out"})
        if not showHidden:
            drives = [d for d in drives if not d.get("hidden")]
        result = {"root": _DRIVES_ROOT, "items": drives}
        _cache.put(key, result, ttl=60)
        return result

    if sys.platform == "darwin":
        mounts_path = Path("/Volumes")
        if not mounts_path.exists():
            root_item = make_item_info(Path("/"), force_type="drive", name_override="Volumes")
            result = {"root": root_item, "items": []}
            _cache.put(key, result, ttl=60)
            return result
        try:
            items, root_item = await _run(
                lambda: explorer_query(mounts_path, "directory,drive,symlink", False, showHidden, excluded_cats)
            )
        except asyncio.TimeoutError:
            return JSONResponse(status_code=504, content={"detail": "Drive listing timed out"})
        root_item["name"] = "Volumes"
        result = {"root": root_item, "items": items}
        _cache.put(key, result, ttl=60)
        return result

    mounts_path = Path("/mnt")
    if not mounts_path.exists():
        root_item = make_item_info(Path("/"), force_type="drive", name_override="Drives")
        result = {"root": root_item, "items": []}
        _cache.put(key, result, ttl=60)
        return result
    try:
        items, root_item = await _run(
            lambda: explorer_query(mounts_path, "directory,drive,symlink", False, showHidden, excluded_cats)
        )
    except asyncio.TimeoutError:
        return JSONResponse(status_code=504, content={"detail": "Drive listing timed out"})
    root_item["name"] = "Drives"
    result = {"root": root_item, "items": items}
    _cache.put(key, result, ttl=60)
    return result
