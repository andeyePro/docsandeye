"""Load and validate ``media-plan.json`` (version 1).

The plan is produced by ``@docsandeye/core``; this module is the consumer, and
it is strict for the same reason :mod:`docsandeye_render.plan` is — an invalid
plan is a build error, not something to paper over at encode time.  It reuses
:class:`docsandeye_render.plan.PlanError` so the CLI reports both plans the
same way.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .plan import PlanError

__all__ = [
    "MediaPlan", "MediaJob", "PlanError", "load", "loads",
    "MEDIA_PLAN_VERSION", "RENDITIONS", "OUTPUT_KEYS", "rendition_keys",
]

MEDIA_PLAN_VERSION = 1
RENDITIONS = (720, 1080)
RENDITION_KEYS = tuple(f"{codec}_{height}" for height in RENDITIONS for codec in ("av1", "h264"))
OUTPUT_KEYS = frozenset({*RENDITION_KEYS, "poster", "captions"})


def rendition_keys(height: int) -> tuple[str, str]:
    """The AV1 and H.264 output names for ``height``, in call order."""
    return f"av1_{height}", f"h264_{height}"


@dataclass
class MediaJob:
    """One encode job from the plan.  Paths are relative to the project root."""

    key: str
    media: str
    source: str
    poster_source: str
    duration_s: float | None = None
    captions: str | None = None
    renditions: list[int] = field(default_factory=lambda: list(RENDITIONS))
    outputs: dict[str, str] = field(default_factory=dict)
    index: int | None = None

    def source_path(self, project_root: Path) -> Path:
        return (Path(project_root) / self.source).resolve()

    def poster_source_path(self, project_root: Path) -> Path:
        return (Path(project_root) / self.poster_source).resolve()

    def captions_path(self, project_root: Path) -> Path | None:
        if self.captions is None:
            return None
        return (Path(project_root) / self.captions).resolve()

    def output_name(self, name: str) -> str:
        """The file name for output ``name``, from the plan where it says so."""
        recorded = self.outputs.get(name)
        if recorded:
            return Path(recorded).name
        if name == "poster":
            return f"{self.key}.webp"
        if name == "captions" and self.captions:
            return Path(self.captions).name
        codec, _, height = name.partition("_")
        return f"{self.key}-{height}.{'webm' if codec == 'av1' else 'mp4'}"

    def output_path(self, out_dir: Path, name: str) -> Path:
        return (Path(out_dir) / self.output_name(name)).resolve()


@dataclass
class MediaPlan:
    version: int
    project_root: str
    jobs: list[MediaJob] = field(default_factory=list)
    path: Path | None = None

    def resolved_project_root(self, override: Path | str | None = None) -> Path:
        return Path(override if override is not None else self.project_root).resolve()


def load(path: Path | str) -> MediaPlan:
    """Load and validate the media plan at ``path``."""
    p = Path(path)
    try:
        raw = p.read_text(encoding="utf-8")
    except OSError as exc:
        raise PlanError(f"cannot read media plan {p}: {exc}") from exc
    return loads(raw, path=p)


def loads(text: str, path: Path | None = None) -> MediaPlan:
    try:
        doc = json.loads(text)
    except json.JSONDecodeError as exc:
        raise PlanError(f"media plan is not valid JSON: {exc}") from exc
    return _build(doc, path)


def _build(doc: Any, path: Path | None) -> MediaPlan:
    if not isinstance(doc, dict):
        raise PlanError("media plan must be a JSON object")

    version = doc.get("version")
    if version != MEDIA_PLAN_VERSION:
        raise PlanError(
            f"unsupported media plan version {version!r}; expected {MEDIA_PLAN_VERSION}",
            index=None,
            field="version",
        )

    project_root = doc.get("project_root", ".")
    if not isinstance(project_root, str):
        raise PlanError("project_root must be a string", index=None, field="project_root")

    raw_jobs = doc.get("jobs")
    if not isinstance(raw_jobs, list):
        raise PlanError("jobs must be a list", index=None, field="jobs")

    jobs = [_job(entry, i) for i, entry in enumerate(raw_jobs)]

    seen: set[str] = set()
    for job in jobs:
        if job.key in seen:
            raise PlanError(f"duplicate job key {job.key!r}", index=job.index, field="key")
        seen.add(job.key)

    return MediaPlan(version=MEDIA_PLAN_VERSION, project_root=project_root, jobs=jobs, path=path)


def _job(entry: Any, index: int) -> MediaJob:
    if not isinstance(entry, dict):
        raise PlanError(f"job {index} must be a JSON object", index=index)

    key = entry.get("key")
    if not isinstance(key, str) or not key:
        raise PlanError(f"job {index} has no key", index=index, field="key")

    source = _required_string(entry, "source", key, index)
    poster_source = _required_string(entry, "poster_source", key, index)

    captions = entry.get("captions")
    if captions is not None and (not isinstance(captions, str) or not captions):
        raise PlanError(f"job {key}: captions must be a non-empty string",
                        index=index, field="captions")

    duration = entry.get("duration_s")
    if duration is not None and not isinstance(duration, (int, float)):
        raise PlanError(f"job {key}: duration_s must be a number",
                        index=index, field="duration_s")

    renditions = entry.get("renditions", list(RENDITIONS))
    if not isinstance(renditions, list) or not renditions:
        raise PlanError(f"job {key}: renditions must be a non-empty list",
                        index=index, field="renditions")
    for height in renditions:
        if height not in RENDITIONS:
            raise PlanError(
                f"job {key}: unknown rendition {height!r}; "
                f"expected one of {', '.join(str(h) for h in RENDITIONS)}",
                index=index,
                field="renditions",
            )

    outputs = entry.get("outputs")
    if not isinstance(outputs, dict):
        raise PlanError(f"job {key}: outputs must be an object", index=index, field="outputs")
    for name, value in outputs.items():
        if name not in OUTPUT_KEYS:
            raise PlanError(
                f"job {key}: unknown outputs key {name!r}; "
                f"expected one of {', '.join(sorted(OUTPUT_KEYS))}",
                index=index,
                field=f"outputs.{name}",
            )
        if not isinstance(value, str) or not value:
            raise PlanError(f"job {key}: outputs.{name} must be a non-empty string",
                            index=index, field=f"outputs.{name}")

    if captions is not None and "captions" not in outputs:
        raise PlanError(
            f"job {key}: captions is set but outputs.captions is missing",
            index=index,
            field="outputs.captions",
        )
    if captions is None and "captions" in outputs:
        raise PlanError(
            f"job {key}: outputs.captions is set but captions is missing",
            index=index,
            field="captions",
        )

    return MediaJob(
        key=key,
        media=str(entry.get("media", key)),
        source=source,
        poster_source=poster_source,
        duration_s=duration,
        captions=captions,
        renditions=[int(h) for h in renditions],
        outputs={str(k): str(v) for k, v in outputs.items()},
        index=index,
    )


def _required_string(entry: dict, name: str, key: str, index: int) -> str:
    value = entry.get(name)
    if not isinstance(value, str) or not value:
        raise PlanError(f"job {key}: {name} must be a non-empty string", index=index, field=name)
    return value
