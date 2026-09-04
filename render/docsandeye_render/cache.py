"""The render manifest: what was produced, by which driver, when.

The manifest doubles as the cache index.  A job is cached when the previous
manifest recorded it as rendered (or cached) *and* every output it recorded is
still on disk — nothing else needs hashing, because the plan's job key already
encodes the inputs.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

__all__ = [
    "MANIFEST_NAME", "MANIFEST_VERSION", "empty", "load", "save",
    "manifest_path", "timestamp", "cache_hit",
]

MANIFEST_NAME = "manifest.json"
MANIFEST_VERSION = 1
CACHEABLE_STATUSES = frozenset({"rendered", "cached"})


def manifest_path(out_dir: Path | str) -> Path:
    return Path(out_dir) / MANIFEST_NAME


def empty() -> dict[str, Any]:
    return {"version": MANIFEST_VERSION, "jobs": {}}


def timestamp(now: datetime | None = None) -> str:
    moment = now or datetime.now(timezone.utc)
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load(out_dir: Path | str) -> dict[str, Any]:
    """Read the manifest from ``out_dir``; an unreadable one is treated as empty."""
    path = manifest_path(out_dir)
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return empty()
    if not isinstance(doc, dict) or doc.get("version") != MANIFEST_VERSION:
        return empty()
    jobs = doc.get("jobs")
    if not isinstance(jobs, dict):
        return empty()
    return {"version": MANIFEST_VERSION, "jobs": jobs}


def save(out_dir: Path | str, manifest: dict[str, Any]) -> Path:
    """Write the manifest deterministically (sorted keys, 2-space indent, final newline)."""
    path = manifest_path(out_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    return path


def cache_hit(previous: dict[str, Any], key: str, project_root: Path) -> dict[str, Any] | None:
    """Return the previous entry for ``key`` if it can be reused, else ``None``."""
    entry = previous.get("jobs", {}).get(key)
    if not isinstance(entry, dict):
        return None
    if entry.get("status") not in CACHEABLE_STATUSES:
        return None
    outputs = entry.get("outputs")
    if not isinstance(outputs, list) or not outputs:
        return None
    for output in outputs:
        if not isinstance(output, str):
            return None
        candidate = Path(output)
        if not candidate.is_absolute():
            candidate = Path(project_root) / candidate
        if not candidate.exists():
            return None
    return entry
