"""``glb`` subcommand: convert one committed binary STL into a GLB.

A thin wrapper around :func:`glb.stl_to_glb` for the Node CLI's
``docsandeye diff``, which restores a component's derived ``.stl`` from git
history and needs it as GLB for the side-by-side viewer.  Exit codes: 0 on
success, 2 when the input does not exist, 1 when the input is not a usable
binary STL.  Every diagnostic is one ``glb: <reason>`` line on stderr.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .glb import stl_to_glb

__all__ = ["add_glb_parser", "run_glb"]


def add_glb_parser(sub: argparse._SubParsersAction) -> argparse.ArgumentParser:
    parser = sub.add_parser("glb", help="convert one binary STL file to GLB")
    parser.add_argument("input", type=Path, help="binary STL to read")
    parser.add_argument("output", type=Path, help="GLB to write (parent directories are created)")
    return parser


def run_glb(args: argparse.Namespace) -> int:
    source = Path(args.input)
    if not source.is_file():
        print(f"glb: input not found: {source}", file=sys.stderr)
        return 2
    try:
        stl_to_glb(source, Path(args.output))
    except (ValueError, OSError) as exc:
        print(f"glb: {exc}", file=sys.stderr)
        return 1
    return 0
