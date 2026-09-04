"""The camera table.

Loaded from ``camera-table.json`` (package data) so that the table has exactly
one normative source; ``render/fixtures/camera-table.json`` is a verbatim copy
used by the test-suite to detect drift.

The OpenSCAD camera is always given in gimbal form,
``--camera=0,0,0,<rotx>,<roty>,<rotz>,<distance>``, combined with
``--autocenter --viewall``, so the distance is nominal.
``projection_dir`` is the CadQuery SVG ``projectionDir`` for the same view.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

__all__ = [
    "CAMERA_TABLE", "TABLE", "DEFAULT_VIEW", "NOMINAL_DISTANCE",
    "is_known", "view", "camera_arg", "projection_dir", "view_names",
]

TABLE_PATH = Path(__file__).with_name("camera-table.json")

CAMERA_TABLE: dict[str, dict[str, Any]] = json.loads(TABLE_PATH.read_text(encoding="utf-8"))

#: Alias, for callers that read better with the shorter name.
TABLE = CAMERA_TABLE

DEFAULT_VIEW = "iso"
NOMINAL_DISTANCE = 140


def view_names() -> list[str]:
    return sorted(CAMERA_TABLE)


def is_known(name: str) -> bool:
    return name in CAMERA_TABLE


def view(name: str) -> dict[str, Any]:
    """Return the table row for ``name``; raises ``KeyError`` if unknown."""
    try:
        return CAMERA_TABLE[name]
    except KeyError:
        raise KeyError(f"unknown view {name!r}; known views: {', '.join(view_names())}") from None


def _num(value: Any) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def camera_arg(name: str, distance: int = NOMINAL_DISTANCE) -> str:
    """The ``--camera=…`` gimbal argument for ``name``."""
    row = view(name)
    return "--camera=0,0,0,{},{},{},{}".format(
        _num(row["rotx"]), _num(row["roty"]), _num(row["rotz"]), _num(distance)
    )


def projection_dir(name: str) -> tuple[Any, ...]:
    """The CadQuery ``projectionDir`` tuple for ``name``."""
    return tuple(view(name)["projection_dir"])
