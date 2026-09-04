"""Orchestration: plan -> driver -> cache -> manifest.

The runner owns every policy decision the drivers must not know about: which
driver handles a job, when a job is cached, what a hand-exported job means, and
what happens when a tool is missing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Sequence

from . import cache
from .drivers.base import Driver, DriverUnavailable, JobResult
from .plan import Job, Plan

__all__ = ["run", "RunResult", "STATUSES", "HAND_EXPORTED_REASONS"]

STATUSES = ("rendered", "cached", "hand-exported", "skipped", "failed")

HAND_EXPORTED_REASONS = {
    "f3z": "f3z has no headless renderer; keep the derived files up to date by hand",
    "none": "no CAD master; derived files maintained by hand",
}
HAND_EXPORTED_FALLBACK = "hand-exported; derived files maintained by hand"


@dataclass
class RunResult:
    """The outcome of one run."""

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


def run(
    plan: Plan,
    out_dir: Path | str,
    drivers: Sequence[Driver] | None = None,
    force: bool = False,
    allow_missing: bool = False,
    project_root: Path | str | None = None,
) -> RunResult:
    """Render ``plan`` into ``out_dir`` and write the manifest."""
    if drivers is None:
        from .drivers import default_drivers

        drivers = default_drivers()

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
        if job.hand_exported:
            entry = _entry(
                status="hand-exported",
                driver="none",
                outputs=list(job.outputs),
                reason=HAND_EXPORTED_REASONS.get(job.master_format, HAND_EXPORTED_FALLBACK),
                unsupported=job.unsupported,
            )
            _record(manifest, counts, job.key, entry)
            continue

        driver, unsupported_reason = _select(drivers, job)

        if driver is None:
            entry = _entry(status="failed", driver="none", outputs=[],
                           reason=unsupported_reason, unsupported=job.unsupported)
            _record(manifest, counts, job.key, entry)
            failures.append((job.key, unsupported_reason))
            continue

        if not force:
            hit = cache.cache_hit(previous, job.key, root)
            if hit is not None:
                entry = _entry(
                    status="cached",
                    driver=hit.get("driver", driver.name),
                    outputs=list(hit.get("outputs", [])),
                    reason=None,
                    unsupported=list(hit.get("unsupported", job.unsupported)),
                    rendered_at=hit.get("rendered_at"),
                )
                _record(manifest, counts, job.key, entry)
                continue

        try:
            result = driver.render(job, root, out)
        except DriverUnavailable as exc:
            reason = str(exc)
            if allow_missing:
                entry = _entry(status="skipped", driver=driver.name, outputs=[],
                               reason=reason, unsupported=job.unsupported)
                _record(manifest, counts, job.key, entry)
                continue
            entry = _entry(status="failed", driver=driver.name, outputs=[],
                           reason=reason, unsupported=job.unsupported)
            _record(manifest, counts, job.key, entry)
            failures.append((job.key, reason))
            aborted = True
            abort_error = exc
            abort_key = job.key
            break
        except Exception as exc:  # noqa: BLE001 - any driver failure is a job failure
            reason = str(exc) or exc.__class__.__name__
            entry = _entry(status="failed", driver=driver.name, outputs=[],
                           reason=reason, unsupported=job.unsupported)
            _record(manifest, counts, job.key, entry)
            failures.append((job.key, reason))
            continue

        entry = _entry(
            status=result.status,
            driver=driver.name,
            outputs=_relative(result.outputs, root),
            reason=result.reason,
            unsupported=list(result.unsupported),
        )
        _record(manifest, counts, job.key, entry)
        if result.status == "failed":
            failures.append((job.key, result.reason or "render failed"))

    path = cache.save(out, manifest)
    return RunResult(manifest=manifest, counts=counts, failures=failures,
                     aborted=aborted, abort_error=abort_error, abort_key=abort_key,
                     manifest_path=path)


def _select(drivers: Iterable[Driver], job: Job) -> tuple[Driver | None, str | None]:
    """Pick the driver for ``job``, or explain why nothing can render it."""
    candidates = list(drivers)
    for driver in candidates:
        if driver.supports(job.master_format, job.fmt):
            return driver, None
    for driver in candidates:
        lookup = getattr(driver, "unsupported_reason", None)
        if callable(lookup):
            reason = lookup(job.master_format, job.fmt)
            if reason:
                return None, reason
    return None, f"no driver supports {job.master_format} -> {job.fmt}"


def _entry(
    status: str,
    driver: str,
    outputs: list[str],
    reason: str | None,
    unsupported: list[str],
    rendered_at: str | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "status": status,
        "driver": driver,
        "outputs": list(outputs),
        "rendered_at": rendered_at or cache.timestamp(),
        "unsupported": list(unsupported),
    }
    if reason is not None:
        entry["reason"] = reason
    return entry


def _record(manifest: dict[str, Any], counts: dict[str, int], key: str,
            entry: dict[str, Any]) -> None:
    manifest["jobs"][key] = entry
    counts[entry["status"]] = counts.get(entry["status"], 0) + 1


def _relative(outputs: Iterable[Path | str], root: Path) -> list[str]:
    """Record outputs relative to the project root where possible."""
    recorded: list[str] = []
    for output in outputs:
        path = Path(output)
        try:
            recorded.append(path.resolve().relative_to(root).as_posix())
        except ValueError:
            recorded.append(str(path))
    return recorded
