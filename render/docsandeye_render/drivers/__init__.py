"""Render drivers."""

from __future__ import annotations

from .base import Driver, DriverError, DriverUnavailable, JobResult, RenderFailed
from .cadquery_driver import CadQueryDriver
from .openscad import OpenSCADDriver

__all__ = [
    "Driver", "DriverError", "DriverUnavailable", "JobResult", "RenderFailed",
    "OpenSCADDriver", "CadQueryDriver", "default_drivers",
]


def default_drivers() -> list[Driver]:
    """The drivers the CLI uses when the caller does not inject its own."""
    return [OpenSCADDriver(), CadQueryDriver()]
