#!/usr/bin/env python3
"""Build a temporary git repository for the `docsandeye diff` tests.

Nothing here is a committed repository: the tests call this script with a
fresh directory and it creates the history they need, then prints one JSON
object with the commit hashes.

    python3 build_repo.py <dir> [--extras] [--first-stl <path>]

History (three commits, oldest first):

  first   docsandeye.config.yaml; docs/components/top-stop.yaml at 1.0.0 with a
          committed derived file Components/TopStop/TopStop.stl (a well-formed
          BINARY STL: a 12-triangle cube of side 10, written with `struct`);
          a step that uses the part.
  second  the STL edited (cube of side 12) AND design_version bumped to 1.3.0
          in the same commit.
  third   docs/media/vid-01-old.yaml pinned to top-stop@1.0.0 (a STALE video).

`--extras` adds the edge cases the CLI must report, in the same three commits:

  glb-part   f3z master whose derived file is a .glb (fake header bytes),
             1.0.0 -> 1.1.0; media vid-03-glb pins 1.0.0 (restored by copy,
             no python).
  no-geom    scad master with no derived files at all, 1.1.0; media
             vid-02-nogeom pins 1.0.0 (skipped: no derived .glb or .stl).
  vid-04-never  pins top-stop@0.9.0, a version that was never committed
             (skipped: no commit with design_version 0.9.0).

`--first-stl <path>` also saves a copy of the first commit's TopStop.stl bytes
so a test can compare them without running git itself.

Output (stdout): {"first": "<sha>", "second": "<sha>", "third": "<sha>"}.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import subprocess
import sys
from pathlib import Path

GIT_ENV = {
    "GIT_AUTHOR_NAME": "docsandeye-test",
    "GIT_AUTHOR_EMAIL": "docsandeye-test",
    "GIT_COMMITTER_NAME": "docsandeye-test",
    "GIT_COMMITTER_EMAIL": "docsandeye-test",
    "GIT_CONFIG_NOSYSTEM": "1",
}

CONFIG = """guides:
  - {id: aep, title: "Aseptic", base: /AEP}
"""

STEP = """---
id: step-01-fit
order: 1
title: Fit the top stop
guide: aep
parts:
  - {component: top-stop, qty: 2, cat: printed}
{media}---
Slide a top stop over each electrode.
"""


def cube_stl(size: float) -> bytes:
    """A binary STL of an axis-aligned cube from the origin to (size, size, size): 12 triangles."""
    s = float(size)
    v = [(0, 0, 0), (s, 0, 0), (s, s, 0), (0, s, 0), (0, 0, s), (s, 0, s), (s, s, s), (0, s, s)]
    faces = [
        ((0, 0, -1), (0, 2, 1), (0, 3, 2)),
        ((0, 0, 1), (4, 5, 6), (4, 6, 7)),
        ((0, -1, 0), (0, 1, 5), (0, 5, 4)),
        ((1, 0, 0), (1, 2, 6), (1, 6, 5)),
        ((0, 1, 0), (2, 3, 7), (2, 7, 6)),
        ((-1, 0, 0), (3, 0, 4), (3, 4, 7)),
    ]
    out = bytearray(struct.pack("<80s", b"docsandeye diff fixture cube"))
    out += struct.pack("<I", 12)
    for normal, *tris in faces:
        for tri in tris:
            out += struct.pack("<3f", *normal)
            for index in tri:
                out += struct.pack("<3f", *v[index])
            out += struct.pack("<H", 0)
    return bytes(out)


def fake_glb(tag: bytes) -> bytes:
    """Not a valid glTF asset, just recognisable bytes with the GLB magic (the CLI only copies it)."""
    body = b'{"asset":{"version":"2.0","docsandeye_fixture":"' + tag + b'"}}'
    body += b" " * (-len(body) % 4)
    total = 12 + 8 + len(body)
    return struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<II", len(body), 0x4E4F534A) + body


def component_yaml(cid: str, name: str, version: str, master: str, sources: list[str], derived: list[str],
                   changelog: list[tuple[str, str, str]]) -> str:
    lines = [f"id: {cid}", f"name: {name}", "kind: printed", f"design_version: {version}", f"master_format: {master}",
             f"source_files: {json.dumps(sources)}"]
    if derived:
        lines.append(f"derived_files: {json.dumps(derived)}")
    if changelog:
        lines.append("changelog:")
        for ver, date, note in changelog:
            lines.append(f"  - {{version: {ver}, date: {date}, note: {json.dumps(note)}}}")
    return "\n".join(lines) + "\n"


def media_yaml(mid: str, hero: str) -> str:
    return (f"id: {mid}\ntype: video\nfile: assets/video/{mid}.mp4\nposter: assets/video/{mid}.jpg\n"
            f'duration_s: 15\nshot_date: 2026-02-15\nshot_by: "Example Maker"\nhero: [{hero}]\n')


def write_media(root: Path, mid: str, hero: str) -> None:
    write(root, f"docs/media/{mid}.yaml", media_yaml(mid, hero))
    write(root, f"assets/video/{mid}.mp4", b"\0" * 24)
    write(root, f"assets/video/{mid}.jpg", b"\xff\xd8\xff\xd9")


def write(root: Path, rel: str, data: str | bytes) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, bytes):
        path.write_bytes(data)
    else:
        path.write_text(data, encoding="utf-8")


def git(root: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=root, check=True, capture_output=True, text=True,
                            env={**os.environ, **GIT_ENV})
    return result.stdout.strip()


def commit(root: Path, message: str) -> str:
    git(root, "add", "-A")
    git(root, "commit", "--quiet", "--no-verify", "--no-gpg-sign", "-m", message)
    return git(root, "rev-parse", "HEAD")


def build(root: Path, extras: bool, first_stl: Path | None) -> dict[str, str]:
    root.mkdir(parents=True, exist_ok=True)
    git(root, "init", "--quiet", "--initial-branch=main")

    # first: the component at 1.0.0 with its derived STL committed.
    write(root, "docsandeye.config.yaml", CONFIG)
    write(root, "docs/components/top-stop.yaml", component_yaml(
        "top-stop", "Top Stop", "1.0.0", "scad", ["Components/TopStop/TopStop.scad"],
        ["Components/TopStop/TopStop.stl"], [("1.0.0", "2026-01-10", "Initial release.")]))
    write(root, "Components/TopStop/TopStop.scad", "cube(10);\n")
    stl_v1 = cube_stl(10)
    write(root, "Components/TopStop/TopStop.stl", stl_v1)
    write(root, "docs/steps/step-01-fit.md", STEP.replace("{media}", ""))
    if extras:
        write(root, "docs/components/glb-part.yaml", component_yaml(
            "glb-part", "GLB Part", "1.0.0", "f3z", ["Components/GlbPart/GlbPart.f3z"],
            ["Components/GlbPart/GlbPart.glb"], []))
        write(root, "Components/GlbPart/GlbPart.f3z", b"f3z placeholder\n")
        write(root, "Components/GlbPart/GlbPart.glb", fake_glb(b"glb-part 1.0.0"))
        write(root, "docs/components/no-geom.yaml", component_yaml(
            "no-geom", "No Geometry", "1.1.0", "scad", ["Components/NoGeom/NoGeom.scad"], [], []))
        write(root, "Components/NoGeom/NoGeom.scad", "sphere(5);\n")
    if first_stl is not None:
        first_stl.parent.mkdir(parents=True, exist_ok=True)
        first_stl.write_bytes(stl_v1)
    first = commit(root, "Add top stop at 1.0.0")

    # second: geometry edited and version bumped in ONE commit.
    write(root, "Components/TopStop/TopStop.scad", "cube(12);\n")
    write(root, "Components/TopStop/TopStop.stl", cube_stl(12))
    write(root, "docs/components/top-stop.yaml", component_yaml(
        "top-stop", "Top Stop", "1.3.0", "scad", ["Components/TopStop/TopStop.scad"],
        ["Components/TopStop/TopStop.stl"],
        [("1.0.0", "2026-01-10", "Initial release."), ("1.3.0", "2026-03-01", "Chamfer on electrode bore.")]))
    if extras:
        write(root, "Components/GlbPart/GlbPart.glb", fake_glb(b"glb-part 1.1.0"))
        write(root, "docs/components/glb-part.yaml", component_yaml(
            "glb-part", "GLB Part", "1.1.0", "f3z", ["Components/GlbPart/GlbPart.f3z"],
            ["Components/GlbPart/GlbPart.glb"], []))
    second = commit(root, "Top stop 1.3.0: bore chamfer")

    # third: a video recorded with the old version.
    write_media(root, "vid-01-old", "top-stop@1.0.0")
    media = ["vid-01-old"]
    if extras:
        write_media(root, "vid-02-nogeom", "no-geom@1.0.0")
        write_media(root, "vid-03-glb", "glb-part@1.0.0")
        write_media(root, "vid-04-never", "top-stop@0.9.0")
        media += ["vid-02-nogeom", "vid-03-glb", "vid-04-never"]
    write(root, "docs/steps/step-01-fit.md", STEP.replace("{media}", f"media: {json.dumps(media)}\n"))
    third = commit(root, "Add media recorded with top stop 1.0.0")

    return {"first": first, "second": second, "third": third}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("dir", type=Path, help="directory to create the repository in")
    parser.add_argument("--extras", action="store_true", help="add the edge-case components and media")
    parser.add_argument("--first-stl", type=Path, default=None, help="also save the first commit's STL bytes here")
    args = parser.parse_args(argv)
    print(json.dumps(build(args.dir, args.extras, args.first_stl)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
