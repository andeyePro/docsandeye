"""The driver seam.

A driver knows how to turn one job into files.  The runner only ever talks to
this protocol, so the whole pipeline is testable with neither OpenSCAD nor
CadQuery installed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol, runtime_checkable

__all__ = ["Driver", "JobResult", "DriverError", "DriverUnavailable", "RenderFailed"]


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
