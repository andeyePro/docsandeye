"""Command line entry point: ``python3 -m docsandeye_render …``.

Invoked by the Node CLI (``@docsandeye/cli``).  Everything it prints is meant
to be read in a build log: one ``<key>: <reason>`` line per problem on stderr,
one summary line on stdout.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__, encode, media_plan, runner
from .drivers import default_drivers
from .drivers.ffmpeg import FfmpegDriver
from .plan import PlanError, load

__all__ = ["main", "build_parser"]

PROGRAM = "docsandeye_render"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=PROGRAM,
        description="Render the artefacts named by a Docs&I render plan.",
    )
    parser.add_argument("--version", action="version", version=f"{PROGRAM} {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    render = sub.add_parser("render", help="render every job in a plan")
    render.add_argument("--plan", required=True, type=Path, help="path to render-plan.json")
    render.add_argument("--out", required=True, type=Path, help="output directory")
    render.add_argument("--force", action="store_true", help="ignore the cache")
    render.add_argument("--allow-missing", action="store_true",
                        help="skip jobs whose tool is not installed instead of failing")
    render.add_argument("--project-root", type=Path, default=None,
                        help="override the plan's project_root")

    encode_cmd = sub.add_parser("encode", help="encode every video job in a media plan")
    encode_cmd.add_argument("--plan", required=True, type=Path, help="path to media-plan.json")
    encode_cmd.add_argument("--out", required=True, type=Path, help="output directory")
    encode_cmd.add_argument("--force", action="store_true", help="ignore the cache")
    encode_cmd.add_argument("--allow-missing", action="store_true",
                            help="skip jobs whose tool is not installed instead of failing")
    encode_cmd.add_argument("--project-root", type=Path, default=None,
                            help="override the plan's project_root")

    sub.add_parser("doctor", help="report which render tools are installed")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return int(exc.code or 0)

    if args.command == "doctor":
        return _doctor()
    if args.command == "encode":
        return _encode(args)
    return _render(args)


def _doctor() -> int:
    for driver in [*default_drivers(), FfmpegDriver()]:
        version = driver.version() if driver.available() else None
        if version is not None:
            print(f"{driver.name}: found {version}")
        elif driver.available():
            print(f"{driver.name}: found (version unknown)")
        else:
            print(f"{driver.name}: not found")
    return 0


def _render(args: argparse.Namespace) -> int:
    try:
        plan = load(args.plan)
    except PlanError as exc:
        print(f"{args.plan}: {_where(exc)}{exc.message}", file=sys.stderr)
        return 1

    result = runner.run(
        plan,
        args.out,
        drivers=default_drivers(),
        force=args.force,
        allow_missing=args.allow_missing,
        project_root=args.project_root,
    )
    return _report(result)


def _encode(args: argparse.Namespace) -> int:
    try:
        plan = media_plan.load(args.plan)
    except PlanError as exc:
        print(f"{args.plan}: {_where(exc)}{exc.message}", file=sys.stderr)
        return 1

    result = encode.run(
        plan,
        args.out,
        driver=FfmpegDriver(),
        force=args.force,
        allow_missing=args.allow_missing,
        project_root=args.project_root,
    )
    return _report(result)


def _where(exc: PlanError) -> str:
    location = "" if exc.index is None else f"job {exc.index}: "
    field = "" if exc.field is None else f"{exc.field}: "
    return f"{location}{field}"


def _report(result) -> int:
    """The shared reporting shape: abort lines, failure lines, one summary line."""
    if result.aborted:
        error = result.abort_error
        print(f"{result.abort_key}: {error}", file=sys.stderr)
        hint = getattr(error, "hint", "")
        print(f"{error}: {hint}" if hint else str(error), file=sys.stderr)
        return result.exit_code

    for key, reason in result.failures:
        print(f"{key}: {reason}", file=sys.stderr)
    print(result.summary)
    return result.exit_code


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
