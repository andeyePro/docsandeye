"""Orchestration for the encode stage: media plan -> encoder -> cache -> manifest.

The mirror image of :mod:`docsandeye_render.runner`, one stage along.  The
encoder driver knows how to run ffmpeg; this module owns every policy decision
around it — when a job is cached, what happens when the tool is missing, what
the manifest records and what the process exits with.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import cache
from .drivers.base import DriverUnavailable, EncoderDriver
from .media_plan import MediaJob, MediaPlan

__all__ = ["run", "EncodeRunResult", "STATUSES", "CACHEABLE_STATUSES", "source_stat"]

STATUSES = ("encoded", "cached", "skipped", "failed")
CACHEABLE_STATUSES = frozenset({"encoded", "cached"})


@dataclass
class EncodeRunResult:
    """The outcome of one encode run."""

    manifest: dict[str, Any]
    counts: dict[str, int]
    failures: list[tuple[str, str]] = field(default_factory=list)
    aborted: bool = False
    abort_error: DriverUnavailable | None = None
    abort_key: str | None = None
    manifest_path: Path | None = None

    @property
    def exit_code(self) -> int:
        if self.aborted:
            return 2
        return 1 if self.counts.get("failed", 0) else 0

    @property
    def summary(self) -> str:
        return ", ".join(f"{name} {self.counts.get(name, 0)}" for name in STATUSES)


def source_stat(path: Path) -> dict[str, int] | None:
    """``{"size": …, "mtime_ns": …}`` for ``path``, or ``None`` when it is gone."""
    try:
        st = Path(path).stat()
    except OSError:
        return None
    return {"size": int(st.st_size), "mtime_ns": int(st.st_mtime_ns)}


def run(
    plan: MediaPlan,
    out_dir: Path | str,
    driver: EncoderDriver | None = None,
    force: bool = False,
    allow_missing: bool = False,
    project_root: Path | str | None = None,
) -> EncodeRunResult:
    """Encode ``plan`` into ``out_dir`` and write the media manifest."""
    if driver is None:
        from .drivers.ffmpeg import FfmpegDriver

        driver = FfmpegDriver()

    root = plan.resolved_project_root(project_root)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    previous = cache.load(out)
    manifest: dict[str, Any] = cache.empty()
    counts = {name: 0 for name in STATUSES}
    failures: list[tuple[str, str]] = []
    aborted = False
    abort_error: DriverUnavailable | None = None
    abort_key: str | None = None

    for job in plan.jobs:
        stat = source_stat(job.source_path(root))

        if not force:
            hit = _cache_hit(previous, job, root, stat)
            if hit is not None:
                _record(manifest, counts, job.key, _cached_entry(hit, driver.name))
                continue

        try:
            result = driver.encode(job, root, out)
        except DriverUnavailable as exc:
            reason = str(exc)
            status = "skipped" if allow_missing else "failed"
            _record(manifest, counts, job.key,
                    _entry(status=status, driver=driver.name, reason=reason, stat=stat))
            if allow_missing:
                continue
            failures.append((job.key, reason))
            aborted = True
            abort_error = exc
            abort_key = job.key
            break
        except Exception as exc:  # noqa: BLE001 - any encoder failure is a job failure
            reason = _reason(exc)
            _record(manifest, counts, job.key,
                    _entry(status="failed", driver=driver.name, reason=reason, stat=stat))
            failures.append((job.key, reason))
            continue

        entry = _entry(
            status=result.status,
            driver=driver.name,
            reason=result.reason,
            stat=stat,
            outputs=_relative(result.outputs, root),
            skipped_renditions=list(result.skipped_renditions),
            poster_mode=result.poster_mode,
            probe=result.probe.as_dict() if result.probe is not None else None,
        )
        _record(manifest, counts, job.key, entry)
        if result.status == "failed":
            failures.append((job.key, result.reason or "encode failed"))

    path = cache.save(out, manifest)
    return EncodeRunResult(manifest=manifest, counts=counts, failures=failures,
                           aborted=aborted, abort_error=abort_error, abort_key=abort_key,
                           manifest_path=path)


def _reason(exc: Exception) -> str:
    """A driver failure's reason: what the tool said on stderr, else the message."""
    stderr = (getattr(exc, "stderr", "") or "").strip()
    return stderr or str(exc) or exc.__class__.__name__


def _cache_hit(previous: dict[str, Any], job: MediaJob, root: Path,
               stat: dict[str, int] | None) -> dict[str, Any] | None:
    """The previous entry for ``job`` if it can be reused, else ``None``."""
    entry = previous.get("jobs", {}).get(job.key)
    if not isinstance(entry, dict) or entry.get("status") not in CACHEABLE_STATUSES:
        return None
    if stat is None or entry.get("source_stat") != stat:
        return None
    outputs = entry.get("outputs")
    if not isinstance(outputs, dict) or not outputs:
        return None
    for recorded in outputs.values():
        if not isinstance(recorded, str):
            return None
        candidate = Path(recorded)
        if not candidate.is_absolute():
            candidate = root / candidate
        if not candidate.exists():
            return None
    return entry


def _cached_entry(hit: dict[str, Any], driver_name: str) -> dict[str, Any]:
    """The previous entry, re-stamped as ``cached`` and otherwise untouched."""
    entry = dict(hit)
    entry["status"] = "cached"
    entry.setdefault("driver", driver_name)
    entry.setdefault("encoded_at", cache.timestamp())
    entry.pop("reason", None)
    return entry


def _entry(
    status: str,
    driver: str,
    reason: str | None = None,
    stat: dict[str, int] | None = None,
    outputs: dict[str, str] | None = None,
    skipped_renditions: list[int] | None = None,
    poster_mode: str | None = None,
    probe: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "status": status,
        "driver": driver,
        "outputs": dict(outputs or {}),
        "skipped_renditions": list(skipped_renditions or []),
        "encoded_at": cache.timestamp(),
    }
    if stat is not None:
        entry["source_stat"] = stat
    if poster_mode is not None:
        entry["poster_mode"] = poster_mode
    if probe is not None:
        entry["source_probe"] = probe
    if reason is not None:
        entry["reason"] = reason
    return entry


def _record(manifest: dict[str, Any], counts: dict[str, int], key: str,
            entry: dict[str, Any]) -> None:
    manifest["jobs"][key] = entry
    counts[entry["status"]] = counts.get(entry["status"], 0) + 1


def _relative(outputs: dict[str, Path], root: Path) -> dict[str, str]:
    """Record outputs relative to the project root where possible."""
    recorded: dict[str, str] = {}
    for name, output in outputs.items():
        path = Path(output)
        try:
            recorded[name] = path.resolve().relative_to(root).as_posix()
        except ValueError:
            recorded[name] = str(path)
    return recorded
