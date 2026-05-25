import hashlib
import io
import mimetypes
import os
import shutil
import subprocess
import sys
from pathlib import Path


def _get_thumb_cache_dir() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Caches"
    else:
        base = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache"))
    d = base / "files-workbench" / "thumbs"
    d.mkdir(parents=True, exist_ok=True)
    return d


_THUMB_CACHE_DIR = _get_thumb_cache_dir()

try:
    from PIL import Image, ExifTags
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("Pillow not available, image metadata and resizing will be disabled")

try:
    import mutagen
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False
    print("Mutagen not available, audio metadata will be disabled")

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    print("OpenCV not available, video metadata will be disabled")

FFMPEG_AVAILABLE = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def _thumb_cache_path(source_path: Path, size: int, kind: str = "") -> Path:
    mtime = source_path.stat().st_mtime_ns
    key = hashlib.sha256(f"{source_path}:{mtime}:{size}:{kind}".encode()).hexdigest()
    return _THUMB_CACHE_DIR / f"{key}.jpg"


def resize_image(image_path: Path, size: int) -> bytes:
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow is not available")
    cache_file = _thumb_cache_path(image_path, size)
    if cache_file.exists():
        return cache_file.read_bytes()

    with Image.open(image_path) as img:
        img.thumbnail((size * 4, size), Image.Resampling.LANCZOS)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        data = buf.getvalue()

    cache_file.write_bytes(data)
    return data


def get_video_thumbnail(video_path: Path, size: int) -> bytes:
    """Extract a thumbnail from a video at 10% of its duration using ffmpeg."""
    if not FFMPEG_AVAILABLE:
        raise RuntimeError("ffmpeg/ffprobe is not available")
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow is not available")

    cache_file = _thumb_cache_path(video_path, size, kind="video")
    if cache_file.exists():
        return cache_file.read_bytes()

    # Get duration with ffprobe
    duration = 0.0
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        duration = float(result.stdout.strip())
    except Exception:
        duration = 0.0

    seek_seconds = duration * 0.1 if duration > 0 else 0.0

    # Extract frame with ffmpeg
    cmd = [
        "ffmpeg",
        "-ss", f"{seek_seconds}s",
        "-i", str(video_path),
        "-vframes", "1",
        "-f", "image2",
        "-vcodec", "mjpeg",
        "pipe:1",
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=60)
    if result.returncode != 0 or not result.stdout:
        raise RuntimeError(f"ffmpeg failed to extract frame from {video_path}")

    raw = result.stdout

    # Resize with Pillow
    with Image.open(io.BytesIO(raw)) as img:
        img.thumbnail((size * 4, size), Image.Resampling.LANCZOS)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        data = buf.getvalue()

    cache_file.write_bytes(data)
    return data


def get_audio_thumbnail(audio_path: Path, size: int) -> bytes:
    """Extract embedded artwork from an audio file and resize it."""
    if not MUTAGEN_AVAILABLE:
        raise RuntimeError("Mutagen is not available")
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow is not available")

    cache_file = _thumb_cache_path(audio_path, size, kind="audio")
    if cache_file.exists():
        return cache_file.read_bytes()

    raw = None

    # ID3 tags (MP3, AIFF, WAV with ID3)
    try:
        from mutagen.id3 import ID3
        tags = ID3(audio_path)
        for tag in tags.values():
            if tag.FrameID == "APIC":
                raw = tag.data
                break
    except Exception:
        pass

    # MP4 / AAC / M4A / M4B
    if raw is None:
        try:
            from mutagen.mp4 import MP4
            mp4 = MP4(audio_path)
            covers = mp4.tags.get("covr", []) if mp4.tags else []
            if covers:
                raw = bytes(covers[0])
        except Exception:
            pass

    # FLAC
    if raw is None:
        try:
            from mutagen.flac import FLAC
            flac = FLAC(audio_path)
            if flac.pictures:
                raw = flac.pictures[0].data
        except Exception:
            pass

    # OGG Vorbis / Opus
    if raw is None:
        try:
            import base64
            import struct
            from mutagen.oggvorbis import OggVorbis
            ogg = OggVorbis(audio_path)
            for b64 in ogg.get("metadata_block_picture", []):
                data_bytes = base64.b64decode(b64)
                mime_len = struct.unpack(">I", data_bytes[4:8])[0]
                desc_len = struct.unpack(">I", data_bytes[8 + mime_len:12 + mime_len])[0]
                img_offset = 12 + mime_len + desc_len + 16
                raw = data_bytes[img_offset + 4:]
                break
        except Exception:
            pass

    if raw is None:
        raise RuntimeError(f"No embedded artwork found in {audio_path}")

    with Image.open(io.BytesIO(raw)) as img:
        img.thumbnail((size * 4, size), Image.Resampling.LANCZOS)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        data = buf.getvalue()

    cache_file.write_bytes(data)
    return data


def thumb_cache_size_bytes() -> int:
    """Return the total size of all .jpg files in the thumbnail cache directory."""
    try:
        return sum(f.stat().st_size for f in _THUMB_CACHE_DIR.glob("*.jpg"))
    except Exception:
        return 0


def enforce_thumb_quota(max_bytes: int) -> None:
    """Delete oldest thumbnail files (by mtime) until total size is under max_bytes."""
    try:
        files = sorted(
            _THUMB_CACHE_DIR.glob("*.jpg"),
            key=lambda f: f.stat().st_mtime,
        )
        total = sum(f.stat().st_size for f in files)
        for f in files:
            if total <= max_bytes:
                break
            try:
                size = f.stat().st_size
                f.unlink()
                total -= size
            except Exception:
                pass
    except Exception:
        pass


def get_image_metadata(path: Path) -> dict:
    if not PIL_AVAILABLE:
        return {"error": "Pillow not available"}
    try:
        with Image.open(path) as img:
            meta = {
                "format": img.format,
                "mode": img.mode,
                "width": img.width,
                "height": img.height,
                "has_transparency": img.mode in ("RGBA", "LA", "P"),
            }
            if hasattr(img, "_getexif") and img._getexif():
                exif = {}
                for tag_id, val in img._getexif().items():
                    tag = ExifTags.TAGS.get(tag_id, tag_id)
                    exif[str(tag)] = str(val)
                meta["exif"] = exif
            return meta
    except Exception as e:
        return {"error": str(e)}


def get_video_metadata(path: Path) -> dict:
    if not OPENCV_AVAILABLE:
        return {"error": "OpenCV not available"}
    try:
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            return {"error": "Could not open video"}
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        return {
            "width": width,
            "height": height,
            "frame_count": frame_count,
            "fps": fps,
            "duration_seconds": duration,
            "duration_formatted": f"{int(duration // 60)}:{int(duration % 60):02d}",
        }
    except Exception as e:
        return {"error": str(e)}


def get_audio_metadata(path: Path) -> dict:
    if not MUTAGEN_AVAILABLE:
        return {"error": "Mutagen not available"}
    try:
        audio = mutagen.File(str(path))
        if audio is None:
            return {"error": "Could not parse audio"}
        meta = {
            "format": str(audio.mime[0]) if audio.mime else "unknown",
            "length_seconds": getattr(audio.info, "length", 0),
            "bitrate": getattr(audio.info, "bitrate", 0),
        }
        if hasattr(audio, "tags") and audio.tags:
            tags = {}
            for k, v in audio.tags.items():
                tags[k] = str(v[0]) if isinstance(v, list) and len(v) == 1 else str(v)
            meta["tags"] = tags
        return meta
    except Exception as e:
        return {"error": str(e)}


def get_file_metadata(path: Path) -> dict:
    from datetime import datetime
    st = path.stat()
    mime, _ = mimetypes.guess_type(str(path))
    mime = mime or "application/octet-stream"

    meta = {
        "name": path.name,
        "path": str(path),
        "size_bytes": st.st_size,
        "created": datetime.fromtimestamp(st.st_ctime).isoformat(),
        "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
        "extension": path.suffix.lower(),
        "mime_type": mime,
    }

    if mime.startswith("image/") and PIL_AVAILABLE:
        meta.update(get_image_metadata(path))
    elif mime.startswith("video/"):
        meta.update(get_video_metadata(path))
    elif mime.startswith("audio/"):
        meta.update(get_audio_metadata(path))

    return meta
