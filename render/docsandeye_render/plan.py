"""Load and validate ``render-plan.json`` (version 1).

The plan is produced by ``@docsandeye/core``; this module is the consumer.  It
is deliberately strict: an invalid plan is a build error, not something to
paper over at render time.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import views

__all__ = [
    "Plan", "Job", "PlanError", "load", "loads",
    "MASTER_FORMATS", "OUTPUT_FORMATS", "JOB_STATUSES", "RESERVED_PARAMETERS",
]

PLAN_VERSION = 1
MASTER_FORMATS = frozenset({"scad", "step", "f3z", "none"})
OUTPUT_FORMATS = frozenset({"png", "stl", "svg", "glb"})
JOB_STATUSES = frozenset({"hand-exported"})
RESERVED_PARAMETERS = frozenset({"explode", "annotate"})
DEFAULT_FORMAT = "png"

_SCALARS = (bool, int, float, str)


class PlanError(Exception):
    """A render plan that cannot be used.

    ``index`` is the offending job's position in ``jobs`` (``None`` for
    document-level problems), ``field`` the offending field's dotted name.
    """

    def __init__(self, message: str, index: int | None = None, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.index = index
        self.field = field

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"PlanError(message={self.message!r}, index={self.index!r}, field={self.field!r})"


@dataclass
class Job:
    """One render job from the plan."""

    key: str
    component: str
    design_version: str
    render_id: str
    master_format: str
    source_files: list[str]
    parameters: dict[str, Any]
    options: dict[str, Any]
    outputs: list[str]
    status: str | None = None
    index: int | None = None

    @property
    def fmt(self) -> str:
        return self.options.get("format", DEFAULT_FORMAT)

    @property
    def view(self) -> str:
        return self.options.get("view", views.DEFAULT_VIEW)

    @property
    def explode(self) -> bool:
        return self.options.get("explode") is True

    @property
    def annotate(self) -> bool:
        return self.options.get("annotate") is True

    @property
    def hand_exported(self) -> bool:
        return self.status == "hand-exported"

    @property
    def unsupported(self) -> list[str]:
        """Requested options this version accepts but ignores."""
        return ["annotate"] if self.annotate else []

    def source_path(self, project_root: Path) -> Path:
        """Absolute path of the first source file."""
        if not self.source_files:
            raise ValueError(f"job {self.key} has no source files")
        return (Path(project_root) / self.source_files[0]).resolve()

    def output_path(self, out_dir: Path, fmt: str | None = None) -> Path:
        return Path(out_dir) / f"{self.key}.{fmt or self.fmt}"


@dataclass
class Plan:
    version: int
    project_root: str
    jobs: list[Job] = field(default_factory=list)
    path: Path | None = None

    def resolved_project_root(self, override: Path | str | None = None) -> Path:
        return Path(override if override is not None else self.project_root).resolve()


def load(path: Path | str) -> Plan:
    """Load and validate the plan at ``path``."""
    p = Path(path)
    try:
        raw = p.read_text(encoding="utf-8")
    except OSError as exc:
        raise PlanError(f"cannot read render plan {p}: {exc}") from exc
    return loads(raw, path=p)


def loads(text: str, path: Path | None = None) -> Plan:
    try:
        doc = json.loads(text)
    except json.JSONDecodeError as exc:
        raise PlanError(f"render plan is not valid JSON: {exc}") from exc
    return _build(doc, path)


def _build(doc: Any, path: Path | None) -> Plan:
    if not isinstance(doc, dict):
        raise PlanError("render plan must be a JSON object")

    version = doc.get("version")
    if version != PLAN_VERSION:
        raise PlanError(
            f"unsupported render plan version {version!r}; expected {PLAN_VERSION}",
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

    return Plan(version=PLAN_VERSION, project_root=project_root, jobs=jobs, path=path)


def _job(entry: Any, index: int) -> Job:
    if not isinstance(entry, dict):
        raise PlanError(f"job {index} must be a JSON object", index=index)

    key = entry.get("key")
    if not isinstance(key, str) or not key:
        raise PlanError(f"job {index} has no key", index=index, field="key")

    master_format = entry.get("master_format")
    if master_format not in MASTER_FORMATS:
        raise PlanError(
            f"job {key}: unknown master_format {master_format!r}; "
            f"expected one of {', '.join(sorted(MASTER_FORMATS))}",
            index=index,
            field="master_format",
        )

    status = entry.get("status")
    if status is not None and status not in JOB_STATUSES:
        raise PlanError(
            f"job {key}: unknown status {status!r}; "
            f"expected one of {', '.join(sorted(JOB_STATUSES))}",
            index=index,
            field="status",
        )

    options = entry.get("options", {})
    if not isinstance(options, dict):
        raise PlanError(f"job {key}: options must be an object", index=index, field="options")

    fmt = options.get("format", DEFAULT_FORMAT)
    if fmt not in OUTPUT_FORMATS:
        raise PlanError(
            f"job {key}: unknown options.format {fmt!r}; "
            f"expected one of {', '.join(sorted(OUTPUT_FORMATS))}",
            index=index,
            field="options.format",
        )

    view = options.get("view", views.DEFAULT_VIEW)
    if not views.is_known(view):
        raise PlanError(
            f"job {key}: unknown options.view {view!r}; "
            f"expected one of {', '.join(views.view_names())}",
            index=index,
            field="options.view",
        )

    outputs = entry.get("outputs")
    if not isinstance(outputs, list) or not outputs:
        raise PlanError(f"job {key}: outputs must be a non-empty list",
                        index=index, field="outputs")
    for out in outputs:
        if not isinstance(out, str) or not out:
            raise PlanError(f"job {key}: outputs must contain non-empty strings",
                            index=index, field="outputs")

    source_files = entry.get("source_files", [])
    if not isinstance(source_files, list) or not all(isinstance(s, str) for s in source_files):
        raise PlanError(f"job {key}: source_files must be a list of strings",
                        index=index, field="source_files")
    if master_format in {"scad", "step"} and not source_files:
        raise PlanError(f"job {key}: a {master_format} job needs at least one source file",
                        index=index, field="source_files")

    parameters = entry.get("parameters", {})
    if not isinstance(parameters, dict):
        raise PlanError(f"job {key}: parameters must be an object",
                        index=index, field="parameters")
    for name, value in parameters.items():
        _check_parameter(key, index, name, value)

    return Job(
        key=key,
        component=str(entry.get("component", "")),
        design_version=str(entry.get("design_version", "")),
        render_id=str(entry.get("render_id", "")),
        master_format=master_format,
        source_files=list(source_files),
        parameters=dict(parameters),
        options=dict(options),
        outputs=list(outputs),
        status=status,
        index=index,
    )


def _check_parameter(key: str, index: int, name: str, value: Any) -> None:
    field_name = f"parameters.{name}"
    if name in RESERVED_PARAMETERS:
        raise PlanError(
            f"job {key}: parameter {name!r} is reserved; it is set from options.{name}",
            index=index,
            field=field_name,
        )
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, _SCALARS):
                raise PlanError(
                    f"job {key}: parameter {name!r} may only contain bool, number or string items",
                    index=index,
                    field=field_name,
                )
        return
    if not isinstance(value, _SCALARS):
        raise PlanError(
            f"job {key}: parameter {name!r} must be a bool, number, string "
            f"or flat list of those (got {type(value).__name__})",
            index=index,
            field=field_name,
        )
