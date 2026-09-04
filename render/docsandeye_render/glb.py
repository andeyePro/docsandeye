"""Pure-Python binary-STL to GLB conversion.

Single mesh, one primitive, triangle soup (no indices), flat per-face normals
recomputed from the triangle winding, no materials and no textures.  That is
all the guide's viewer needs and it keeps the writer to the standard library.
"""

from __future__ import annotations

import json
import struct
from pathlib import Path

from . import __version__

__all__ = ["stl_to_glb", "read_binary_stl", "GENERATOR"]

GENERATOR = f"docsandeye_render {__version__}"

_HEADER_BYTES = 80
_TRIANGLE_BYTES = 50
_GLB_MAGIC = b"glTF"
_GLB_VERSION = 2
_CHUNK_JSON = 0x4E4F534A  # 'JSON'
_CHUNK_BIN = 0x004E4942   # 'BIN\0'
_FLOAT = 5126             # GL_FLOAT
_ARRAY_BUFFER = 34962     # GL_ARRAY_BUFFER
_MODE_TRIANGLES = 4

Vec3 = tuple[float, float, float]


def read_binary_stl(path: Path | str) -> list[tuple[Vec3, Vec3, Vec3]]:
    """Read a binary STL and return its triangles as vertex triples."""
    data = Path(path).read_bytes()
    if len(data) < _HEADER_BYTES + 4:
        raise ValueError(f"{path}: too short to be a binary STL ({len(data)} bytes)")
    if data[:5].lower() == b"solid" and b"facet normal" in data[:512]:
        raise ValueError(f"{path}: looks like an ASCII STL; binary STL required")
    (count,) = struct.unpack_from("<I", data, _HEADER_BYTES)
    expected = _HEADER_BYTES + 4 + count * _TRIANGLE_BYTES
    if len(data) != expected:
        raise ValueError(
            f"{path}: not a binary STL — header claims {count} triangles "
            f"({expected} bytes) but the file is {len(data)} bytes"
        )
    triangles: list[tuple[Vec3, Vec3, Vec3]] = []
    offset = _HEADER_BYTES + 4
    for _ in range(count):
        values = struct.unpack_from("<12f", data, offset)
        triangles.append((values[3:6], values[6:9], values[9:12]))
        offset += _TRIANGLE_BYTES
    return triangles


def _face_normal(a: Vec3, b: Vec3, c: Vec3) -> Vec3:
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    wx, wy, wz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx = uy * wz - uz * wy
    ny = uz * wx - ux * wz
    nz = ux * wy - uy * wx
    length = (nx * nx + ny * ny + nz * nz) ** 0.5
    if length == 0.0:
        return (0.0, 0.0, 0.0)
    return (nx / length, ny / length, nz / length)


def _pad(data: bytes, fill: bytes) -> bytes:
    remainder = len(data) % 4
    return data if remainder == 0 else data + fill * (4 - remainder)


def stl_to_glb(stl_path: Path | str, glb_path: Path | str) -> Path:
    """Convert the binary STL at ``stl_path`` into a GLB at ``glb_path``."""
    triangles = read_binary_stl(stl_path)
    if not triangles:
        raise ValueError(f"{stl_path}: contains no triangles")

    positions: list[float] = []
    normals: list[float] = []
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    for a, b, c in triangles:
        normal = _face_normal(a, b, c)
        for vertex in (a, b, c):
            positions.extend(vertex)
            normals.extend(normal)
            for i in range(3):
                lo[i] = min(lo[i], vertex[i])
                hi[i] = max(hi[i], vertex[i])

    count = len(triangles) * 3
    position_bytes = struct.pack("<%df" % len(positions), *positions)
    normal_bytes = struct.pack("<%df" % len(normals), *normals)
    # Both blocks are float32 triples, so each is already 4-byte aligned.
    binary = position_bytes + normal_bytes

    document = {
        "asset": {"version": "2.0", "generator": GENERATOR},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{
            "primitives": [{
                "attributes": {"POSITION": 0, "NORMAL": 1},
                "mode": _MODE_TRIANGLES,
            }]
        }],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(position_bytes),
             "target": _ARRAY_BUFFER},
            {"buffer": 0, "byteOffset": len(position_bytes), "byteLength": len(normal_bytes),
             "target": _ARRAY_BUFFER},
        ],
        "accessors": [
            {"bufferView": 0, "byteOffset": 0, "componentType": _FLOAT, "count": count,
             "type": "VEC3", "min": [lo[0], lo[1], lo[2]], "max": [hi[0], hi[1], hi[2]]},
            {"bufferView": 1, "byteOffset": 0, "componentType": _FLOAT, "count": count,
             "type": "VEC3"},
        ],
    }

    json_chunk = _pad(json.dumps(document, separators=(",", ":")).encode("utf-8"), b"\x20")
    bin_chunk = _pad(binary, b"\x00")
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)

    out = Path(glb_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("wb") as handle:
        handle.write(struct.pack("<4sII", _GLB_MAGIC, _GLB_VERSION, total))
        handle.write(struct.pack("<II", len(json_chunk), _CHUNK_JSON))
        handle.write(json_chunk)
        handle.write(struct.pack("<II", len(bin_chunk), _CHUNK_BIN))
        handle.write(bin_chunk)
    return out
