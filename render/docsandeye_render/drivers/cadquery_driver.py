"""The CadQuery driver: STEP masters to STL, SVG and GLB.

CadQuery (and its OCP core) is an optional, heavyweight dependency, so it is
imported lazily inside each call.  That also lets the test-suite inject a fake
``cadquery`` module through ``sys.modules``.
"""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

from .. import views
from ..plan import Job
from .base import DriverUnavailable, JobResult

__all__ = ["CadQueryDriver", "MODULE", "INSTALL_HINT", "PNG_UNSUPPORTED"]

MODULE = "cadquery"
INSTALL_HINT = "install CadQuery 2.4+ (pip install cadquery) to render STEP masters"
NOT_FOUND = f"{MODULE} not found"
PNG_UNSUPPORTED = "png from STEP needs cadquery_png_plugin (not in v0.1)"
MASTER_FORMAT = "step"
FORMATS = frozenset({"stl", "svg", "glb"})
IMAGE_SIZE = (1600, 1200)
SVG_MARGIN = 40
SVG_STROKE_WIDTH = 0.5


class CadQueryDriver:
    """Renders ``step`` masters through CadQuery's importers and exporters."""

    name = "cadquery"

    # -- capability ------------------------------------------------------

    def _module(self) -> Any | None:
        try:
            return importlib.import_module(MODULE)
        except Exception:
            # An OCP that imports but cannot load its shared libraries raises
            # something other than ImportError; either way the driver is out.
            return None

    def available(self) -> bool:
        return self._module() is not None

    def version(self) -> str | None:
        module = self._module()
        if module is None:
            return None
        return getattr(module, "__version__", None)

    def supports(self, master_format: str, fmt: str) -> bool:
        return master_format == MASTER_FORMAT and fmt in FORMATS

    def unsupported_reason(self, master_format: str, fmt: str) -> str | None:
        """Why this driver's own master format cannot be rendered to ``fmt``."""
        if master_format == MASTER_FORMAT and fmt == "png":
            return PNG_UNSUPPORTED
        return None

    # -- rendering -------------------------------------------------------

    def render(self, job: Job, project_root: Path, out_dir: Path) -> JobResult:
        reason = self.unsupported_reason(job.master_format, job.fmt)
        if reason is not None:
            return JobResult(status="failed", outputs=[], reason=reason,
                             unsupported=job.unsupported)

        module = self._module()
        if module is None:
            raise DriverUnavailable(NOT_FOUND, hint=INSTALL_HINT)

        project_root = Path(project_root)
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        source = job.source_path(project_root)
        target = job.output_path(out_dir)

        shape = module.importers.importStep(str(source))

        if job.fmt == "svg":
            module.exporters.export(shape, str(target), exportType="SVG", opt={
                "width": IMAGE_SIZE[0],
                "height": IMAGE_SIZE[1],
                "marginLeft": SVG_MARGIN,
                "marginTop": SVG_MARGIN,
                "showAxes": False,
                "projectionDir": views.projection_dir(job.view),
                "strokeWidth": SVG_STROKE_WIDTH,
                "showHidden": False,
            })
        elif job.fmt == "stl":
            module.exporters.export(shape, str(target), exportType="STL")
        elif job.fmt == "glb":
            assembly = module.Assembly()
            assembly.add(shape)
            assembly.save(str(target), exportType="GLTF")
        else:  # pragma: no cover - guarded by supports()/plan validation
            return JobResult(status="failed", outputs=[],
                             reason=f"{self.name} cannot produce {job.fmt!r}",
                             unsupported=job.unsupported)

        return JobResult(status="rendered", outputs=[target], unsupported=job.unsupported)
