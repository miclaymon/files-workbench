import asyncio
import mimetypes
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse

from lib.blacklist import is_blacklisted
from lib.media_ops import (
    resize_image,
    _thumb_cache_path,
    get_file_metadata,
    get_video_thumbnail,
    get_audio_thumbnail,
    PIL_AVAILABLE,
    MUTAGEN_AVAILABLE,
    FFMPEG_AVAILABLE,
)
from lib import cache as _cache

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=8)

_ALLOWED_SIZES = {48, 64, 96, 128, 256, 512, 1024}


def _ensure_thumb(image_path: Path, size: int) -> Path:
    """Generate thumbnail if not cached, return path to the cache file."""
    resize_image(image_path, size)  # writes to cache if missing
    return _thumb_cache_path(image_path, size)


def _check(path: Path):
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if is_blacklisted(path):
        raise HTTPException(status_code=403, detail="Path is blacklisted")


async def _read_file(path: Path) -> bytes:
    """Read file bytes in the thread pool — avoids anyio.open_file which hangs under load."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, path.read_bytes)


@router.get("/capabilities")
async def get_capabilities():
    return {"thumbnails": PIL_AVAILABLE}


@router.get("/image")
async def serve_image(path: str = Query(...), size: int = Query(default=None)):
    """Serve image with optional thumbnail resizing."""
    p = Path(path)
    _check(p)

    if size and size in _ALLOWED_SIZES:
        if not PIL_AVAILABLE:
            raise HTTPException(status_code=501, detail="Thumbnail resizing requires Pillow (pip install Pillow)")
        loop = asyncio.get_running_loop()
        try:
            cache_path = await loop.run_in_executor(_executor, lambda: _ensure_thumb(p, size))
            return FileResponse(
                str(cache_path),
                media_type="image/jpeg",
                headers={"Cache-Control": "public, max-age=3600"},
            )
        except Exception:
            raise HTTPException(status_code=500, detail="Thumbnail generation failed")

    data = await _read_file(p)
    mime, _ = mimetypes.guess_type(str(p))
    return Response(content=data, media_type=mime or "application/octet-stream")


@router.get("/preview")
async def serve_preview(path: str = Query(...)):
    p = Path(path)
    _check(p)
    return FileResponse(str(p))


@router.get("/thumbnail")
async def serve_thumbnail(path: str = Query(...), size: int = Query(default=256)):
    p = Path(path)
    _check(p)
    if size not in _ALLOWED_SIZES:
        size = 256
    mime, _ = mimetypes.guess_type(str(p))
    mime = mime or ""
    loop = asyncio.get_running_loop()

    if mime.startswith("image/") and PIL_AVAILABLE:
        try:
            data = await loop.run_in_executor(_executor, lambda: resize_image(p, size))
            return Response(
                content=data,
                media_type="image/jpeg",
                headers={"Cache-Control": "public, max-age=3600"},
            )
        except Exception:
            pass
    elif mime.startswith("video/") and FFMPEG_AVAILABLE and PIL_AVAILABLE:
        try:
            data = await loop.run_in_executor(_executor, lambda: get_video_thumbnail(p, size))
            return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})
        except Exception:
            pass
    elif mime.startswith("audio/") and MUTAGEN_AVAILABLE and PIL_AVAILABLE:
        try:
            data = await loop.run_in_executor(_executor, lambda: get_audio_thumbnail(p, size))
            return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="Thumbnail not available")


@router.get("/metadata")
async def get_metadata(path: str = Query(...)):
    p = Path(path)
    _check(p)
    mtime = p.stat().st_mtime_ns if p.exists() else 0
    key = _cache.make_key("metadata", str(p), mtime)
    cached = _cache.get(key)
    if cached is not None:
        return cached
    loop = asyncio.get_running_loop()
    meta = await loop.run_in_executor(_executor, lambda: get_file_metadata(p))
    _cache.put(key, meta, ttl=60)
    return meta


@router.get("/artwork")
async def get_audio_artwork(path: str = Query(...)):
    """Extract embedded cover art from audio files (ID3, MP4, FLAC, OGG)."""
    p = Path(path)
    _check(p)

    def _extract():
        # ID3 tags (MP3, AIFF, WAV with ID3)
        try:
            from mutagen.id3 import ID3
            tags = ID3(p)
            for tag in tags.values():
                if tag.FrameID == "APIC":
                    return tag.data, tag.mime or "image/jpeg"
        except Exception:
            pass

        # MP4 / AAC / M4A / M4B
        try:
            from mutagen.mp4 import MP4, MP4Cover
            mp4 = MP4(p)
            covers = mp4.tags.get("covr", []) if mp4.tags else []
            if covers:
                cover = covers[0]
                mime = "image/png" if cover.imageformat == MP4Cover.FORMAT_PNG else "image/jpeg"
                return bytes(cover), mime
        except Exception:
            pass

        # FLAC
        try:
            from mutagen.flac import FLAC
            flac = FLAC(p)
            if flac.pictures:
                pic = flac.pictures[0]
                return pic.data, pic.mime or "image/jpeg"
        except Exception:
            pass

        # OGG Vorbis / Opus (picture stored as base64 METADATA_BLOCK_PICTURE)
        try:
            import base64
            import struct
            from mutagen.oggvorbis import OggVorbis
            ogg = OggVorbis(p)
            for b64 in ogg.get("metadata_block_picture", []):
                data = base64.b64decode(b64)
                mime_len = struct.unpack(">I", data[4:8])[0]
                mime = data[8:8 + mime_len].decode("ascii")
                desc_len = struct.unpack(">I", data[8 + mime_len:12 + mime_len])[0]
                img_offset = 12 + mime_len + desc_len + 16
                img_data = data[img_offset + 4:]
                return img_data, mime
        except Exception:
            pass

        return None, None

    loop = asyncio.get_running_loop()
    data, mime = await loop.run_in_executor(_executor, _extract)
    if data is None:
        raise HTTPException(status_code=404, detail="No embedded artwork found")
    return Response(
        content=data,
        media_type=mime,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/preview/text")
async def get_text_preview(path: str = Query(...), max_lines: int = Query(default=100)):
    p = Path(path)
    _check(p)

    def _read():
        for encoding in ("utf-8", "latin-1"):
            try:
                with open(p, "r", encoding=encoding, errors="ignore") as f:
                    lines = []
                    for i, line in enumerate(f):
                        if i >= max_lines:
                            break
                        lines.append(line.rstrip("\n"))
                return lines, encoding
            except UnicodeDecodeError:
                continue
        return [], "utf-8"

    loop = asyncio.get_running_loop()
    lines, encoding = await loop.run_in_executor(_executor, _read)
    return {
        "text": "\n".join(lines),
        "lines": lines,
        "total_lines": len(lines),
        "encoding": encoding,
    }
