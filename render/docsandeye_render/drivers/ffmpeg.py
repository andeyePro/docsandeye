"""The ffmpeg encoder driver: one source clip to AV1/WebM, H.264/MP4, poster and captions.

Codec parameters come from the v0.2 research briefing and are not tunable:
SVT-AV1 preset 6 / CRF 28 / 10-bit with 96 kbps Opus, and x264 preset slow /
CRF 20 / 8-bit with 128 kbps AAC, both with ``+faststart``.  Posters are WebP
(or a byte copy when the author already supplied WebP or AVIF); captions are
copied verbatim.

Everything the driver does is a subprocess call, so the whole stage is testable
against a fake ``ffmpeg``/``ffprobe`` — which is how it is tested, since the
build container has neither.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from ..media_plan import MediaJob, rendition_keys
from .base import DriverUnavailable, EncodeResult, Probe, RenderFailed

__all__ = [
    "FfmpegDriver", "EXECUTABLE", "PROBE_EXECUTABLE", "INSTALL_HINT",
    "POSTER_MODES", "COPY_POSTER_SUFFIXES",
]

EXECUTABLE = "ffmpeg"
PROBE_EXECUTABLE = "ffprobe"
INSTALL_HINT = "install ffmpeg 7+ with libsvtav1, libx264, libopus, libwebp"
POSTER_MODES = ("copy", "convert", "generate")
COPY_POSTER_SUFFIXES = frozenset({".webp", ".avif"})
POSTER_HEIGHT = 720
POSTER_TIMESTAMP = "1"
WEBP_ARGS = ("-c:v", "libwebp", "-quality", "80")

AV1_ARGS = (
    "-c:v", "libsvtav1", "-preset", "6", "-crf", "28", "-pix_fmt", "yuv420p10le",
    "-c:a", "libopus", "-b:a", "96k", "-movflags", "+faststart",
)
H264_ARGS = (
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
)
PROBE_ARGS = ("-v", "error", "-print_format", "json", "-show_streams", "-show_format")


class FfmpegDriver:
    """Encodes media jobs by shelling out to ``ffmpeg`` and ``ffprobe``."""

    name = "ffmpeg"

    def __init__(self, executable: str = EXECUTABLE, probe_executable: str = PROBE_EXECUTABLE):
        self.executable = executable
        self.probe_executable = probe_executable

    # -- capability ------------------------------------------------------

    def _which(self, executable: str) -> str | None:
        return shutil.which(executable)

    def available(self) -> bool:
        return self._which(self.executable) is not None

    def version(self) -> str | None:
        exe = self._which(self.executable)
        if exe is None:
            return None
        try:
            proc = subprocess.run([exe, "-version"], capture_output=True, text=True, timeout=30)
        except (OSError, subprocess.SubprocessError):
            return None
        return _parse_version(proc.stdout, proc.stderr)

    # -- probing ---------------------------------------------------------

    def probe(self, source: Path) -> Probe:
        """``ffprobe`` the first video stream of ``source``."""
        exe = self._which(self.probe_executable)
        if exe is None:
            raise DriverUnavailable(f"{self.probe_executable} not found", hint=INSTALL_HINT)
        argv = [exe, *PROBE_ARGS, str(Path(source).resolve())]
        try:
            proc = subprocess.run(argv, capture_output=True, text=True)
        except OSError as exc:
            raise RenderFailed(f"{self.probe_executable} could not be run: {exc}") from exc
        if proc.returncode != 0:
            raise RenderFailed(
                f"{self.probe_executable} exited {proc.returncode}",
                stderr=proc.stderr or "",
            )
        return _parse_probe(proc.stdout, self.probe_executable, source)

    # -- encoding --------------------------------------------------------

    def encode(self, job: MediaJob, project_root: Path, out_dir: Path) -> EncodeResult:
        """Probe, encode every kept rendition, make the poster, copy the captions."""
        if self._which(self.executable) is None:
            raise DriverUnavailable(f"{self.executable} not found", hint=INSTALL_HINT)

        project_root = Path(project_root)
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        source = job.source_path(project_root)

        probe = self.probe(source)

        outputs: dict[str, Path] = {}
        skipped: list[int] = []
        for height in sorted(job.renditions):
            if height > probe.height:
                skipped.append(height)
                continue
            av1_key, h264_key = rendition_keys(height)
            av1 = job.output_path(out_dir, av1_key)
            h264 = job.output_path(out_dir, h264_key)
            self._run(self._scale_argv(source, height, AV1_ARGS, av1))
            outputs[av1_key] = av1
            self._run(self._scale_argv(source, height, H264_ARGS, h264))
            outputs[h264_key] = h264

        poster = job.output_path(out_dir, "poster")
        poster_mode = self._poster(job, project_root, source, poster)
        outputs["poster"] = poster

        captions_source = job.captions_path(project_root)
        if captions_source is not None:
            captions = job.output_path(out_dir, "captions")
            shutil.copyfile(captions_source, captions)
            outputs["captions"] = captions

        return EncodeResult(
            status="encoded",
            outputs=outputs,
            skipped_renditions=skipped,
            poster_mode=poster_mode,
            probe=probe,
        )

    # -- poster ----------------------------------------------------------

    def _poster(self, job: MediaJob, project_root: Path, source: Path, target: Path) -> str:
        """Copy, convert or generate the poster; returns which of the three happened."""
        authored = job.poster_source_path(project_root)
        if authored.exists():
            if authored.suffix.lower() in COPY_POSTER_SUFFIXES:
                shutil.copyfile(authored, target)
                return "copy"
            self._run(["-y", "-i", str(authored), *WEBP_ARGS, str(target)])
            return "convert"
        self._run([
            "-y", "-ss", POSTER_TIMESTAMP, "-i", str(source), "-frames:v", "1",
            "-vf", f"scale=-2:{POSTER_HEIGHT}", *WEBP_ARGS, str(target),
        ])
        return "generate"

    # -- argv ------------------------------------------------------------

    @staticmethod
    def _scale_argv(source: Path, height: int, codec_args: tuple[str, ...], target: Path) -> list[str]:
        return ["-y", "-i", str(source), "-vf", f"scale=-2:{height}", *codec_args, str(target)]

    # -- process ---------------------------------------------------------

    def _run(self, argv: list[str]) -> subprocess.CompletedProcess:
        exe = self._which(self.executable)
        if exe is None:
            raise DriverUnavailable(f"{self.executable} not found", hint=INSTALL_HINT)
        try:
            proc = subprocess.run([exe, *argv], capture_output=True, text=True)
        except OSError as exc:
            raise RenderFailed(f"{self.executable} could not be run: {exc}") from exc
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip()
            summary = detail.splitlines()[-1] if detail else "no output"
            raise RenderFailed(
                f"{self.executable} exited {proc.returncode}: {summary}",
                stderr=proc.stderr or "",
            )
        return proc


def _parse_probe(stdout: str, executable: str, source: Path) -> Probe:
    try:
        doc = json.loads(stdout or "{}")
    except json.JSONDecodeError as exc:
        raise RenderFailed(f"{executable} produced invalid JSON for {source}: {exc}") from exc
    streams = doc.get("streams") if isinstance(doc, dict) else None
    stream = None
    if isinstance(streams, list):
        for candidate in streams:
            if isinstance(candidate, dict) and candidate.get("codec_type") == "video":
                stream = candidate
                break
    if stream is None:
        raise RenderFailed(f"{executable} found no video stream in {source}")
    try:
        width = int(stream["width"])
        height = int(stream["height"])
    except (KeyError, TypeError, ValueError) as exc:
        raise RenderFailed(f"{executable} reported no dimensions for {source}") from exc
    return Probe(width=width, height=height, duration_s=_duration(doc))


def _duration(doc: dict) -> float | None:
    fmt = doc.get("format")
    raw = fmt.get("duration") if isinstance(fmt, dict) else None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


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
