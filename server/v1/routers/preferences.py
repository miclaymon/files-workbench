import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/_api/v1/preferences")

_CONFIG_DIR = Path(__file__).parent.parent.parent.parent / "config" / "preferences"
_DEFAULTS_FILE = _CONFIG_DIR / "default-preferences.json"
_USER_FILE = _CONFIG_DIR / "user-preferences.json"


def _deep_merge(base: dict, overrides: dict) -> dict:
    result = dict(base)
    for key, value in overrides.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _load_defaults() -> dict:
    try:
        return json.loads(_DEFAULTS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load default preferences: {exc}")


def _load_user() -> dict:
    if not _USER_FILE.exists():
        return {}
    try:
        text = _USER_FILE.read_text(encoding="utf-8").strip()
        return json.loads(text) if text else {}
    except json.JSONDecodeError:
        return {}


@router.get("")
async def get_preferences():
    defaults = _load_defaults()
    user = _load_user()
    merged = _deep_merge(defaults, user)
    return JSONResponse(content=merged)


@router.get("/schema")
async def get_preferences_schema():
    schema_file = _CONFIG_DIR / "preferences.schema.json"
    try:
        return JSONResponse(content=json.loads(schema_file.read_text(encoding="utf-8")))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load schema: {exc}")


@router.put("")
async def save_preferences(body: dict):
    try:
        _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        _USER_FILE.write_text(json.dumps(body, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save preferences: {exc}")
    return JSONResponse(content={"ok": True})
