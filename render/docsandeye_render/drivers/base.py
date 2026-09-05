"""The driver seam.

A driver knows how to turn one job into files.  The runner only ever talks to
this protocol, so the whole pipeline is testable with neither OpenSCAD nor
CadQuery installed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol, runtime_checkable

__all__ = [
    "Driver", "JobResult", "DriverError", "DriverUnavailable", "RenderFailed",
    "EncoderDriver", "EncodeResult", "Probe",
]


class DriverError(Exception):
    """Base class for driver problems."""


class DriverUnavailable(DriverError):
    """The underlying tool is not installed.

    Raised from ``render``; the runner either aborts the run (default) or, with
    ``allow_missing``, marks the job skipped and carries on.  ``hint`` is the
    one-line install instruction the CLI prints after the failure line.
    """

    def __init__(self, message: str, hint: str = ""):
        super().__init__(message)
        self.message = message
        self.hint = hint


class RenderFailed(DriverError):
    """The tool ran and failed.  ``stderr`` carries what it said."""

    def __init__(self, message: str, stderr: str = ""):
        super().__init__(message)
        self.message = message
        self.stderr = stderr


@dataclass
class JobResult:
    """What a driver produced for one job."""

    status: str
    outputs: list[Path] = field(default_factory=list)
    reason: str | None = None
    unsupported: list[str] = field(default_factory=list)


@runtime_checkable
class Driver(Protocol):
    """Structural type every renderer satisfies."""

    name: str

    def available(self) -> bool:
        """Whether the underlying tool can be used in this environment."""

    def version(self) -> str | None:
        """The tool's version string, or ``None`` when it is unavailable."""

    def supports(self, master_format: str, fmt: str) -> bool:
        """Whether this driver renders ``master_format`` to ``fmt``."""

    def render(self, job, project_root: Path, out_dir: Path) -> JobResult:
        """Render one job, writing into ``out_dir``."""


# ---------------------------------------------------------------------------
# The encoder seam: the same shape, one stage along.
#
# Video encoding gets its own protocol rather than another ``Driver``: there is
# no master format to dispatch on, the unit of work is a media job, and the
# result carries facts (probe, poster mode, skipped renditions) a render job
# has no use for.  ``EncoderDriver`` and ``Driver`` are deliberately disjoint —
# nothing satisfies both.


@dataclass
class Probe:
    """What the encoder learned about a source clip."""

    width: int
    height: int
    duration_s: float | None = None

    def as_dict(self) -> dict:
        return {"width": self.width, "height": self.height, "duration_s": self.duration_s}


@dataclass
class EncodeResult:
    """What an encoder produced for one media job.

    ``outputs`` maps the plan's output names (``av1_720``, ``poster``, …) to the
    files actually written; names whose rendition was skipped are absent.
    """

    status: str
    outputs: dict[str, Path] = field(default_factory=dict)
    skipped_renditions: list[int] = field(default_factory=list)
    poster_mode: str | None = None
    probe: Probe | None = None
    reason: str | None = None


@runtime_checkable
class EncoderDriver(Protocol):
    """Structural type every video encoder satisfies."""

    name: str

    def available(self) -> bool:
        """Whether the underlying tool can be used in this environment."""

    def version(self) -> str | None:
        """The tool's version string, or ``None`` when it is unavailable."""

    def probe(self, source: Path) -> Probe:
        """Measure ``source``: pixel dimensions and duration."""

    def encode(self, job, project_root: Path, out_dir: Path) -> EncodeResult:
        """Encode one media job, writing into ``out_dir``."""
