import base64
import mimetypes
import os
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, FIRST_COMPLETED, wait as futures_wait
from datetime import datetime
from pathlib import Path
from typing import Optional

from lib.blacklist import is_excluded


def _is_hidden(path: Path) -> bool:
    if path.name.startswith("."):
        return True
    if os.name == "nt":
        try:
            import ctypes
            attrs = ctypes.windll.kernel32.GetFileAttributesW(str(path))
            if attrs != -1 and (attrs & 2):
                return True
        except Exception:
            pass
    return False


def _item_type(path: Path) -> str:
    try:
        if path.is_symlink():
            return "symlink"
        if path.is_dir():
            return "directory"
        if path.is_file():
            if path.suffix.lower() == ".lnk":
                return "shortcut"
            mime, _ = mimetypes.guess_type(str(path))
            return mime or "application/octet-stream"
    except OSError:
        pass
    return "unknown"


def make_item_info(path: Path, *, force_type: Optional[str] = None, name_override: Optional[str] = None) -> dict:
    name = name_override or path.name or str(path)
    itype = force_type or _item_type(path)
    hidden = _is_hidden(path)

    size = date_created = date_modified = date_accessed = None
    try:
        st = path.stat()
        if path.is_file():
            size = st.st_size
        date_modified = st.st_mtime
        date_accessed = st.st_atime
        date_created = getattr(st, "st_birthtime", st.st_ctime)
    except OSError:
        pass

    return {
        "name": name,
        "path": str(path),
        "type": itype,
        "hidden": hidden,
        "icon": None,
        "uri": None,
        "size": size,
        "date_created": date_created,
        "date_modified": date_modified,
        "date_accessed": date_accessed,
    }


def stat_path(path: Path) -> dict:
    st = path.stat()
    return {
        "name": path.name,
        "path": str(path),
        "kind": "dir" if path.is_dir() else "file",
        "size": st.st_size if path.is_file() else None,
        "mtime": datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds"),
    }


_VALID_TYPES = {"directory", "file", "symlink", "shortcut", "drive", "root"}


def _parse_type_filter(type_str: str) -> set:
    return {t.strip() for t in type_str.split(",") if t.strip() in _VALID_TYPES}


def _type_matches(itype: str, type_filter: set) -> bool:
    if itype in type_filter:
        return True
    if "file" in type_filter and "/" in itype:
        return True
    return False


def _entry_to_item(entry: os.DirEntry, include_metadata: bool = True) -> Optional[dict]:
    """Convert a DirEntry to an item dict.

    include_metadata=False skips stat() entirely — type/name/path only.
    On Linux, is_dir/is_file/is_symlink use the cached d_type from readdir
    so they cost no extra syscall; stat() is the only expensive part.
    """
    try:
        # DirEntry.is_symlink() uses cached d_type on Linux — no extra syscall
        is_link = entry.is_symlink()
        if is_link:
            itype = "symlink"
        elif entry.is_dir(follow_symlinks=False):
            itype = "directory"
        elif entry.is_file(follow_symlinks=False):
            if entry.name.lower().endswith(".lnk"):
                itype = "shortcut"
            else:
                mime, _ = mimetypes.guess_type(entry.name)
                itype = mime or "application/octet-stream"
        else:
            return None  # skip special files (sockets, devices, etc.)

        hidden = entry.name.startswith(".")
        if not hidden and os.name == "nt":
            try:
                import ctypes
                attrs = ctypes.windll.kernel32.GetFileAttributesW(entry.path)
                if attrs != -1 and (attrs & 2):
                    hidden = True
            except Exception:
                pass

        size = date_created = date_modified = date_accessed = None
        if include_metadata:
            try:
                # lstat avoids following symlinks for stat — prevents hangs on dead symlinks
                st = entry.stat(follow_symlinks=False)
                if not is_link and itype not in ("directory",):
                    size = st.st_size
                date_modified = st.st_mtime
                date_accessed = st.st_atime
                date_created = getattr(st, "st_birthtime", st.st_ctime)
            except OSError:
                pass

        return {
            "name": entry.name,
            "path": entry.path,
            "type": itype,
            "hidden": hidden,
            "icon": None,
            "uri": None,
            "size": size,
            "date_created": date_created,
            "date_modified": date_modified,
            "date_accessed": date_accessed,
        }
    except OSError:
        return None


def list_dir_filtered(
    path: Path,
    type_filter: set,
    show_hidden: bool = True,
    excluded_categories=None,
    include_metadata: bool = True,
) -> list:
    items = []
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    # Pure string check first — skips hidden entries before any
                    # DirEntry method that might call lstat().
                    if not show_hidden and entry.name.startswith("."):
                        continue
                    if is_excluded(Path(entry.path), excluded_categories):
                        continue
                    item = _entry_to_item(entry, include_metadata=include_metadata)
                    if item is None:
                        continue
                    if not show_hidden and item["hidden"]:
                        continue
                    if not _type_matches(item["type"], type_filter):
                        continue
                    items.append(item)
                except Exception:
                    continue  # skip any single bad entry without breaking the whole listing
    except (PermissionError, OSError):
        pass
    items.sort(key=lambda x: (
        0 if x["type"] in ("directory", "drive", "root") else 1 if x["type"] == "symlink" else 2,
        x["name"].lower(),
    ))
    return items


def list_dir_recursive(root: Path, type_filter: set, show_hidden: bool = True, excluded_categories=None) -> list:
    all_items: list = []
    lock = threading.Lock()

    def traverse(p: Path) -> list:
        subdirs = []
        try:
            with os.scandir(p) as it:
                for entry in it:
                    try:
                        if is_excluded(Path(entry.path), excluded_categories):
                            continue
                        item = _entry_to_item(entry)
                        if item is None:
                            continue
                        if not show_hidden and item["hidden"]:
                            continue
                        if _type_matches(item["type"], type_filter):
                            with lock:
                                all_items.append(item)
                        if item["type"] == "directory":
                            subdirs.append(Path(entry.path))
                    except Exception:
                        continue
        except (PermissionError, OSError):
            pass
        return subdirs

    with ThreadPoolExecutor(max_workers=16) as pool:
        pending = {pool.submit(traverse, root)}
        while pending:
            done, pending = futures_wait(pending, return_when=FIRST_COMPLETED)
            for fut in done:
                try:
                    for subdir in fut.result():
                        pending.add(pool.submit(traverse, subdir))
                except Exception:
                    pass

    return all_items


def explorer_query(path: Path, type_str: str, recursive: bool, show_hidden: bool, excluded_categories=None, include_metadata: bool = True) -> tuple:
    type_filter = _parse_type_filter(type_str)
    if recursive:
        items = list_dir_recursive(path, type_filter, show_hidden=show_hidden, excluded_categories=excluded_categories)
    else:
        items = list_dir_filtered(path, type_filter, show_hidden=show_hidden, excluded_categories=excluded_categories, include_metadata=include_metadata)
    root_item = make_item_info(path)
    return items, root_item


def windows_drives() -> list:
    import string, ctypes
    drives = []
    for letter in string.ascii_uppercase:
        drive = Path(f"{letter}:\\")
        if not drive.exists():
            continue
        try:
            buf = ctypes.create_unicode_buffer(1024)
            ctypes.windll.kernel32.GetVolumeInformationW(
                ctypes.c_wchar_p(str(drive)), buf, ctypes.sizeof(buf),
                None, None, None, None, 0,
            )
            label = buf.value.strip()
            name = f"{label} ({letter}:)" if label else f"{letter}:"
        except Exception:
            name = f"{letter}:"
        drives.append(make_item_info(drive, force_type="drive", name_override=name))
    return drives


_LINUX_SYSTEM_FSTYPES = {
    "proc", "sysfs", "devtmpfs", "devpts", "tmpfs", "securityfs",
    "cgroup", "cgroup2", "pstore", "bpf", "autofs", "mqueue",
    "hugetlbfs", "debugfs", "tracefs", "fusectl", "configfs",
    "ramfs", "efivarfs", "fuse.gvfsd-fuse", "rpc_pipefs",
    "nfsd", "overlay", "nsfs", "squashfs", "swap", "fuse",
}
_LINUX_SYSTEM_PREFIXES = (
    "/proc", "/sys", "/dev", "/run/user", "/run/lock",
    "/snap", "/var/lib/docker", "/tmp", "/run/snapd", "/boot",
)


def linux_drives() -> list:
    seen: set[str] = set()
    items: list[dict] = []
    try:
        with open("/proc/mounts", encoding="utf-8") as f:
            for line in f:
                parts = line.split()
                if len(parts) < 3:
                    continue
                fstype = parts[2]
                mountpoint = parts[1].replace("\\040", " ")
                if fstype in _LINUX_SYSTEM_FSTYPES:
                    continue
                if mountpoint == "/":
                    continue
                if any(mountpoint.startswith(p) for p in _LINUX_SYSTEM_PREFIXES):
                    continue
                if mountpoint in seen:
                    continue
                path = Path(mountpoint)
                if path.exists() and path.is_dir():
                    seen.add(mountpoint)
                    items.append(make_item_info(path, force_type="drive"))
    except OSError:
        pass
    items.sort(key=lambda x: x["name"].lower())
    return items


def _language_for_path(path: Path) -> str:
    ext = path.suffix.lower().lstrip(".")
    lang_map = {
        "js": "javascript", "mjs": "javascript", "cjs": "javascript",
        "ts": "typescript", "tsx": "typescript",
        "py": "python", "json": "json", "md": "markdown",
        "html": "html", "htm": "html", "css": "css",
        "rs": "rust", "cpp": "cpp", "cc": "cpp", "cxx": "cpp", "h": "cpp", "hpp": "cpp",
        "vue": "html", "yaml": "yaml", "yml": "yaml", "sh": "shell",
    }
    return lang_map.get(ext, "plaintext")


def preview_file(path: Path, max_bytes: int = 300_000) -> dict:
    if not path.exists():
        raise FileNotFoundError(str(path))
    if path.is_dir():
        return {"kind": "dir"}

    mime, _ = mimetypes.guess_type(str(path))
    mime = mime or "application/octet-stream"

    if mime.startswith("image/"):
        data = path.read_bytes()[:max_bytes]
        b64 = base64.b64encode(data).decode("ascii")
        return {"kind": "image", "mime": mime, "dataUrl": f"data:{mime};base64,{b64}"}

    raw = path.read_bytes()[:max_bytes]
    try:
        text = raw.decode("utf-8")
        return {"kind": "text", "language": _language_for_path(path), "text": text}
    except UnicodeDecodeError:
        return {"kind": "binary", "bytes": path.stat().st_size, "mime": mime}


def simple_list_dir(
    path: Path,
    excluded_categories=None,
    include_metadata: bool = True,
    show_hidden: bool = True,
) -> list[dict]:
    """Listing for fs.list_dir: name/path/kind/size/mtime. Uses scandir for speed.

    Hidden check happens first — pure string op, no syscalls — so problematic
    entries (dead FUSE mounts, hung NFS paths) that are hidden are skipped
    before any DirEntry method that might call lstat().

    include_metadata=False skips stat() calls entirely, returning name/kind in one
    readdir pass, which is nearly instantaneous even on large directories.
    """
    items = []
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    # Pure string check — no syscall. Must come before any DirEntry
                    # method (is_symlink/is_dir/is_file) that may call lstat().
                    hidden = entry.name.startswith(".")
                    if not show_hidden and hidden:
                        continue
                    if is_excluded(Path(entry.path), excluded_categories):
                        continue
                    is_link = entry.is_symlink()
                    if entry.is_dir(follow_symlinks=False):
                        kind = "dir"
                    elif entry.is_file(follow_symlinks=False) or is_link:
                        kind = "file"
                    else:
                        kind = "other"
                    size = mtime = None
                    if include_metadata:
                        try:
                            st = entry.stat(follow_symlinks=False)
                            if kind == "file":
                                size = st.st_size
                            mtime = datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds")
                        except OSError:
                            pass
                    items.append({
                        "name": entry.name,
                        "path": entry.path,
                        "kind": kind,
                        "size": size,
                        "mtime": mtime,
                        "hidden": hidden,
                    })
                except Exception:
                    continue
    except (PermissionError, OSError):
        pass
    items.sort(key=lambda x: (0 if x["kind"] == "dir" else 1, x["name"].lower()))
    return items


# ── write operations ──────────────────────────────────────────────────────────

def open_with_system(path: Path) -> None:
    if sys.platform == "win32":
        os.startfile(str(path))
    elif sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=True)
    else:
        subprocess.run(["xdg-open", str(path)], check=True)


def create_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch()


def create_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
