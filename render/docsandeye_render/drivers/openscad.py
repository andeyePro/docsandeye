"""The OpenSCAD driver: ``.scad`` masters to PNG, STL, SVG and GLB.

SVG is produced in two passes — mesh first, then a throwaway wrapper that
projects it — because OpenSCAD's own SVG export is 2D-only.  GLB is the STL
pass followed by :func:`docsandeye_render.glb.stl_to_glb`.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from .. import glb, params, views
from ..plan import Job
from .base import DriverUnavailable, JobResult, RenderFailed

__all__ = ["OpenSCADDriver", "projection_wrapper_source", "EXECUTABLE", "INSTALL_HINT"]

EXECUTABLE = "openscad"
INSTALL_HINT = "install OpenSCAD 2024+ (Manifold backend) and ensure it is on PATH"
NOT_FOUND = f"{EXECUTABLE} not found"
IMAGE_SIZE = (1600, 1200)
MASTER_FORMAT = "scad"
FORMATS = frozenset({"png", "stl", "svg", "glb"})
LIBRARY_SUBDIR = ("Components", "lib")


def projection_wrapper_source(stl_path: Path | str) -> str:
    """The one-line ``.scad`` wrapper that projects an STL to 2D for SVG export."""
    return f'projection(cut=false) import("{stl_path}");'


class OpenSCADDriver:
    """Renders ``scad`` masters by shelling out to ``openscad``."""

    name = "openscad"

    def __init__(self, executable: str = EXECUTABLE):
        self.executable = executable

    # -- capability ------------------------------------------------------

    def _which(self) -> str | None:
        return shutil.which(self.executable)

    def available(self) -> bool:
        return self._which() is not None

    def version(self) -> str | None:
        exe = self._which()
        if exe is None:
            return None
        try:
            proc = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=30)
        except (OSError, subprocess.SubprocessError):
            return None
        return _parse_version(proc.stdout, proc.stderr)

    def supports(self, master_format: str, fmt: str) -> bool:
        return master_format == MASTER_FORMAT and fmt in FORMATS

    def unsupported_reason(self, master_format: str, fmt: str) -> str | None:
        return None

    # -- rendering -------------------------------------------------------

    def render(self, job: Job, project_root: Path, out_dir: Path) -> JobResult:
        project_root = Path(project_root)
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        source = job.source_path(project_root)

        if job.fmt == "png":
            target = job.output_path(out_dir, "png")
            self._run(self._png_argv(job, source, target), project_root)
            outputs = [target]
        elif job.fmt == "stl":
            target = job.output_path(out_dir, "stl")
            self._run(self._stl_argv(job, source, target), project_root)
            outputs = [target]
        elif job.fmt == "svg":
            stl = job.output_path(out_dir, "stl")
            svg = job.output_path(out_dir, "svg")
            self._run(self._stl_argv(job, source, stl), project_root)
            self._project_to_svg(stl, svg, project_root)
            outputs = [svg, stl]
        elif job.fmt == "glb":
            stl = job.output_path(out_dir, "stl")
            target = job.output_path(out_dir, "glb")
            self._run(self._stl_argv(job, source, stl), project_root)
            glb.stl_to_glb(stl, target)
            outputs = [target, stl]
        else:  # pragma: no cover - guarded by supports()/plan validation
            raise RenderFailed(f"{self.name} cannot produce {job.fmt!r}")

        return JobResult(status="rendered", outputs=outputs, unsupported=job.unsupported)

    # -- argv ------------------------------------------------------------

    @staticmethod
    def _defines(job: Job) -> list[str]:
        argv: list[str] = []
        if job.explode:
            argv += ["-D", "explode=1"]
        argv += params.argv(job.parameters)
        return argv

    def _png_argv(self, job: Job, source: Path, target: Path) -> list[str]:
        return [
            "-o", str(target),
            "--render",
            "--backend=manifold",
            "--autocenter",
            "--viewall",
            "--imgsize={},{}".format(*IMAGE_SIZE),
            views.camera_arg(job.view),
            *self._defines(job),
            str(source),
        ]

    def _stl_argv(self, job: Job, source: Path, target: Path) -> list[str]:
        return [
            "-o", str(target),
            "--render",
            "--backend=manifold",
            "--export-format", "binstl",
            *self._defines(job),
            str(source),
        ]

    def _project_to_svg(self, stl: Path, svg: Path, project_root: Path) -> None:
        handle = tempfile.NamedTemporaryFile(
            "w", suffix=".scad", prefix="docsandeye-projection-", delete=False, encoding="utf-8"
        )
        wrapper = Path(handle.name)
        try:
            with handle:
                handle.write(projection_wrapper_source(stl))
            self._run(
                ["-o", str(svg), "--render", "--backend=manifold", str(wrapper)],
                project_root,
            )
        finally:
            wrapper.unlink(missing_ok=True)

    # -- process ---------------------------------------------------------

    def _environment(self, project_root: Path) -> dict[str, str]:
        env = dict(os.environ)
        library = str(Path(project_root).resolve().joinpath(*LIBRARY_SUBDIR))
        inherited = env.get("OPENSCADPATH")
        env["OPENSCADPATH"] = library + (os.pathsep + inherited if inherited else "")
        return env

    def _run(self, argv: list[str], project_root: Path) -> subprocess.CompletedProcess:
        exe = self._which()
        if exe is None:
            raise DriverUnavailable(NOT_FOUND, hint=INSTALL_HINT)
        try:
            proc = subprocess.run(
                [exe, *argv], capture_output=True, text=True,
                env=self._environment(project_root),
            )
        except OSError as exc:
            raise RenderFailed(f"{self.executable} could not be run: {exc}") from exc
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip().splitlines()
            summary = detail[-1] if detail else "no output"
            raise RenderFailed(
                f"{self.executable} exited {proc.returncode}: {summary}",
                stderr=proc.stderr or "",
            )
        return proc


def _parse_version(stdout: str, stderr: str) -> str | None:
    """The token after ``version`` in the first non-empty output line."""
    for line in ((stdout or "") + (stderr or "")).splitlines():
        line = line.strip()
        if not line:
            continue
        tokens = line.split()
        for i, token in enumerate(tokens):
            if token.lower() == "version" and i + 1 < len(tokens):
                return tokens[i + 1]
        return None
    return None
