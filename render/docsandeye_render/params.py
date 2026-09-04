"""OpenSCAD ``-D`` parameter serialisation.

The plan carries parameter values as JSON scalars or flat lists of scalars
(``plan.py`` rejects everything else at load time).  This module turns them
into the two argv entries OpenSCAD expects: the flag ``-D`` and, separately,
``<name>=<serialised value>``.
"""

from __future__ import annotations

import json
from typing import Any, Mapping

__all__ = ["serialise", "serialise_value", "argv"]

_SCALARS = (bool, int, float, str)


def serialise_value(value: Any) -> str:
    """Serialise a single parameter value to its OpenSCAD literal."""
    if isinstance(value, bool):          # before int: bool is a subclass of int
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return json.dumps(value)
    if isinstance(value, str):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    if isinstance(value, list):
        return "[" + ",".join(_serialise_item(item) for item in value) + "]"
    raise TypeError(f"cannot serialise parameter value of type {type(value).__name__}")


def _serialise_item(item: Any) -> str:
    if isinstance(item, list):
        raise TypeError("nested lists are not valid OpenSCAD parameter values")
    if not isinstance(item, _SCALARS):
        raise TypeError(f"cannot serialise list item of type {type(item).__name__}")
    return serialise_value(item)


def serialise(name: str, value: Any) -> list[str]:
    """Return the two argv entries for one ``-D`` assignment."""
    return ["-D", f"{name}={serialise_value(value)}"]


def argv(parameters: Mapping[str, Any]) -> list[str]:
    """Flatten a parameter mapping into argv entries, in insertion order."""
    out: list[str] = []
    for name, value in parameters.items():
        out.extend(serialise(name, value))
    return out
