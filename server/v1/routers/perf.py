import asyncio
import json
from datetime import timezone, datetime
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter()

_log_path = Path(__file__).parent.parent.parent / "logs" / "perf.log"
_executor = None  # reuse the process-default executor


class _Mark(BaseModel):
    name: str
    ms: int


class PerfEntry(BaseModel):
    label: str
    marks: list[_Mark]
    ts: str = ""


def _append(entry: PerfEntry):
    ts = entry.ts or datetime.now(timezone.utc).isoformat()
    marks_str = "  ".join(f"{m.name}={m.ms}ms" for m in entry.marks)
    line = json.dumps({"ts": ts, "label": entry.label, "marks": [m.model_dump() for m in entry.marks]})
    with open(_log_path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


@router.post("/_api/v1/perf")
async def log_perf(entry: PerfEntry):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _append, entry)
    return Response(status_code=204)
