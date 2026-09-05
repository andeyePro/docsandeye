"""Tests for the encode stage: plan loading, the encoder seam, the ffmpeg
driver's exact call shape, the cache, determinism and the repo-hygiene
acceptance criteria (no committed video, tiny fixtures).

Everything here runs against the fixture ``fake-bin/ffmpeg`` /
``fake-bin/ffprobe`` scripts under ``render/fixtures/media`` — there is no
real ffmpeg in this environment.  CLI-level (subprocess) behaviour lives in
``test_encode_cli.py``.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from docsandeye_render import encode, media_plan
from docsandeye_render.drivers.base import Driver, EncoderDriver
from docsandeye_render.drivers.ffmpeg import FfmpegDriver

TESTS_DIR = Path(__file__).resolve().parent
RENDER_DIR = TESTS_DIR.parent
REPO_ROOT = RENDER_DIR.parent
FIXTURES = RENDER_DIR / "fixtures" / "media"
FAKE_BIN = FIXTURES / "fake-bin"
PLAN_PATH = FIXTURES / "media-plan.json"


# ---------------------------------------------------------------------------
# Expected argv, built from the normative lines in .vs/spec.md — not imported
# from the driver's own constants, so a regression in the driver's argument
# order or values actually fails these tests.

AV1_TAIL = [
    "-c:v", "libsvtav1", "-preset", "6", "-crf", "28", "-pix_fmt", "yuv420p10le",
    "-c:a", "libopus", "-b:a", "96k", "-movflags", "+faststart",
]
H264_TAIL = [
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
]


def _abs(path) -> str:
    return str(Path(path).resolve())


def _scale_argv(source, height, tail, out) -> list:
    return ["-y", "-i", _abs(source), "-vf", f"scale=-2:{height}", *tail, _abs(out)]


def _probe_argv(source) -> list:
    return ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", _abs(source)]


def _poster_convert_argv(poster_source, out) -> list:
    return ["-y", "-i", _abs(poster_source), "-c:v", "libwebp", "-quality", "80", _abs(out)]


def _poster_generate_argv(source, out) -> list:
    return [
        "-y", "-ss", "1", "-i", _abs(source), "-frames:v", "1", "-vf", "scale=-2:720",
        "-c:v", "libwebp", "-quality", "80", _abs(out),
    ]


def _read_log(log_path: Path) -> list:
    if not log_path.exists():
        return []
    return [json.loads(line) for line in log_path.read_text().splitlines() if line.strip()]


class _FakeBinMixin:
    """Puts the fixture fake-bin first on PATH and points the log at a temp file."""

    def setUp(self):
        os.chmod(FAKE_BIN / "ffmpeg", 0o755)
        os.chmod(FAKE_BIN / "ffprobe", 0o755)
        self._tmp_obj = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp_obj.name)
        self.out_dir = self.tmp / "out"
        self.log_path = self.tmp / "ffmpeg.log"
        self._old_path = os.environ.get("PATH")
        self._old_log = os.environ.get("DOCSI_FAKE_FFMPEG_LOG")
        # Fake-bin first on PATH, but keep the rest of PATH behind it: the
        # fixture scripts shell out to `sed`/`printf` to build their JSON log
        # lines, so a PATH that has *only* fake-bin breaks their own escaping.
        os.environ["PATH"] = str(FAKE_BIN) + os.pathsep + (self._old_path or "")
        os.environ["DOCSI_FAKE_FFMPEG_LOG"] = str(self.log_path)

    def tearDown(self):
        if self._old_path is None:
            os.environ.pop("PATH", None)
        else:
            os.environ["PATH"] = self._old_path
        if self._old_log is None:
            os.environ.pop("DOCSI_FAKE_FFMPEG_LOG", None)
        else:
            os.environ["DOCSI_FAKE_FFMPEG_LOG"] = self._old_log
        self._tmp_obj.cleanup()

    def _log_len(self) -> int:
        return len(_read_log(self.log_path))


# ---------------------------------------------------------------------------
# AC2 — plan loading raises PlanError with index/field for each listed case.

BASE_JOB = {
    "key": "job-x",
    "media": "job-x",
    "source": "src/x.mp4",
    "poster_source": "src/x.jpg",
    "duration_s": 10,
    "renditions": [720, 1080],
    "outputs": {
        "av1_720": "o-av1-720", "h264_720": "o-h264-720",
        "av1_1080": "o-av1-1080", "h264_1080": "o-h264-1080",
        "poster": "o-poster",
    },
}


def _doc(overrides=None, removals=()):
    job = dict(BASE_JOB)
    job["outputs"] = dict(BASE_JOB["outputs"])
    if overrides:
        job.update(overrides)
    for key in removals:
        job.pop(key, None)
    return {"version": 1, "project_root": ".", "jobs": [job]}


class PlanErrorTests(unittest.TestCase):
    def test_missing_source(self):
        with self.assertRaises(media_plan.PlanError) as ctx:
            media_plan.loads(json.dumps(_doc(removals=("source",))))
        self.assertEqual(ctx.exception.index, 0)
        self.assertEqual(ctx.exception.field, "source")

    def test_missing_poster_source(self):
        with self.assertRaises(media_plan.PlanError) as ctx:
            media_plan.loads(json.dumps(_doc(removals=("poster_source",))))
        self.assertEqual(ctx.exception.index, 0)
        self.assertEqual(ctx.exception.field, "poster_source")

    def test_unknown_outputs_key(self):
        doc = _doc()
        doc["jobs"][0]["outputs"]["bogus"] = "o-bogus"
        with self.assertRaises(media_plan.PlanError) as ctx:
            media_plan.loads(json.dumps(doc))
        self.assertEqual(ctx.exception.index, 0)
        self.assertEqual(ctx.exception.field, "outputs.bogus")

    def test_rendition_not_in_720_1080(self):
        with self.assertRaises(media_plan.PlanError) as ctx:
            media_plan.loads(json.dumps(_doc(overrides={"renditions": [720, 480]})))
        self.assertEqual(ctx.exception.index, 0)
        self.assertEqual(ctx.exception.field, "renditions")

    def test_captions_without_outputs_captions(self):
        with self.assertRaises(media_plan.PlanError) as ctx:
            media_plan.loads(json.dumps(_doc(overrides={"captions": "src/x.en.vtt"})))
        self.assertEqual(ctx.exception.index, 0)
        self.assertEqual(ctx.exception.field, "outputs.captions")

    def test_outputs_captions_without_captions(self):
        doc = _doc()
        doc["jobs"][0]["outputs"]["captions"] = "o-captions"
        with self.assertRaises(media_plan.PlanError) as ctx:
            media_plan.loads(json.dumps(doc))
        self.assertEqual(ctx.exception.index, 0)
        self.assertEqual(ctx.exception.field, "captions")


# ---------------------------------------------------------------------------
# AC3 — the encoder seam is disjoint from the render seam.

class EncoderSeamTests(unittest.TestCase):
    def test_ffmpeg_driver_is_encoder_driver(self):
        self.assertIsInstance(FfmpegDriver(), EncoderDriver)

    def test_ffmpeg_driver_is_not_a_driver(self):
        self.assertNotIsInstance(FfmpegDriver(), Driver)


# ---------------------------------------------------------------------------
# AC4 — the exact, ordered call list for the fixture plan.

class FixtureCallListTests(_FakeBinMixin, unittest.TestCase):
    def test_exact_call_list_and_manifest_shape(self):
        plan = media_plan.load(PLAN_PATH)
        job_a = next(j for j in plan.jobs if j.key == "vid-a")
        job_b = next(j for j in plan.jobs if j.key == "vid-b-720")

        result = encode.run(plan, self.out_dir, driver=FfmpegDriver(), project_root=FIXTURES)

        self.assertEqual(result.exit_code, 0)
        self.assertEqual(result.counts, {"encoded": 2, "cached": 0, "skipped": 0, "failed": 0})
        self.assertEqual(result.summary, "encoded 2, cached 0, skipped 0, failed 0")

        src_a = job_a.source_path(FIXTURES)
        poster_a = job_a.poster_source_path(FIXTURES)
        src_b = job_b.source_path(FIXTURES)

        out_a_av1_720 = self.out_dir / "vid-a-720.webm"
        out_a_h264_720 = self.out_dir / "vid-a-720.mp4"
        out_a_av1_1080 = self.out_dir / "vid-a-1080.webm"
        out_a_h264_1080 = self.out_dir / "vid-a-1080.mp4"
        out_a_poster = self.out_dir / "vid-a.webp"
        out_b_av1_720 = self.out_dir / "vid-b-720-720.webm"
        out_b_h264_720 = self.out_dir / "vid-b-720-720.mp4"
        out_b_poster = self.out_dir / "vid-b-720.webp"

        expected = [
            _probe_argv(src_a),
            _scale_argv(src_a, 720, AV1_TAIL, out_a_av1_720),
            _scale_argv(src_a, 720, H264_TAIL, out_a_h264_720),
            _scale_argv(src_a, 1080, AV1_TAIL, out_a_av1_1080),
            _scale_argv(src_a, 1080, H264_TAIL, out_a_h264_1080),
            _poster_convert_argv(poster_a, out_a_poster),
            _probe_argv(src_b),
            _scale_argv(src_b, 720, AV1_TAIL, out_b_av1_720),
            _scale_argv(src_b, 720, H264_TAIL, out_b_h264_720),
            _poster_generate_argv(src_b, out_b_poster),
        ]
        actual = [call["argv"] for call in _read_log(self.log_path)]
        self.assertEqual(actual, expected)

        # Job A: nothing skipped, all six output keys, poster converted.
        entry_a = result.manifest["jobs"]["vid-a"]
        self.assertEqual(entry_a["skipped_renditions"], [])
        self.assertEqual(entry_a["poster_mode"], "convert")
        self.assertEqual(
            set(entry_a["outputs"]),
            {"av1_720", "h264_720", "av1_1080", "h264_1080", "poster", "captions"},
        )
        self.assertEqual(
            entry_a["source_probe"], {"width": 1920, "height": 1080, "duration_s": 47.0}
        )

        # Job B: 1080 skipped, no 1080 keys, no captions key, poster generated.
        entry_b = result.manifest["jobs"]["vid-b-720"]
        self.assertEqual(entry_b["skipped_renditions"], [1080])
        self.assertEqual(entry_b["poster_mode"], "generate")
        self.assertNotIn("av1_1080", entry_b["outputs"])
        self.assertNotIn("h264_1080", entry_b["outputs"])
        self.assertNotIn("captions", entry_b["outputs"])
        self.assertEqual(
            entry_b["source_probe"], {"width": 1280, "height": 720, "duration_s": 47.0}
        )

        # Captions copied byte-for-byte, for job A only.
        out_captions = job_a.output_path(self.out_dir, "captions")
        self.assertEqual(
            out_captions.read_bytes(), (FIXTURES / "src" / "vid-a.en.vtt").read_bytes()
        )


# ---------------------------------------------------------------------------
# AC5 — the poster-copy branch.

class PosterCopyTests(_FakeBinMixin, unittest.TestCase):
    def test_webp_poster_source_is_copied_not_converted(self):
        plan = media_plan.load(PLAN_PATH)
        job_a = next(j for j in plan.jobs if j.key == "vid-a")

        project = self.tmp / "project"
        shutil.copytree(FIXTURES / "src", project / "src")
        webp_bytes = b"RIFF-fake-webp-poster-bytes-0123456789"
        (project / "src" / "vid-a.webp").write_bytes(webp_bytes)
        job_a.poster_source = "src/vid-a.webp"

        driver = FfmpegDriver()
        result = driver.encode(job_a, project_root=project, out_dir=self.out_dir)

        self.assertEqual(result.poster_mode, "copy")
        self.assertEqual(result.outputs["poster"].read_bytes(), webp_bytes)

        for call in _read_log(self.log_path):
            self.assertNotIn("libwebp", call["argv"])


# ---------------------------------------------------------------------------
# AC6 — missing ffmpeg / ffprobe.

class MissingToolTests(unittest.TestCase):
    def setUp(self):
        os.chmod(FAKE_BIN / "ffmpeg", 0o755)
        os.chmod(FAKE_BIN / "ffprobe", 0o755)
        self._tmp_obj = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp_obj.name)
        self.out_dir = self.tmp / "out"
        self._old_path = os.environ.get("PATH")

    def tearDown(self):
        if self._old_path is None:
            os.environ.pop("PATH", None)
        else:
            os.environ["PATH"] = self._old_path
        self._tmp_obj.cleanup()

    def test_missing_ffmpeg_aborts_run(self):
        os.environ["PATH"] = str(self.tmp / "empty-bin")
        (self.tmp / "empty-bin").mkdir()
        plan = media_plan.load(PLAN_PATH)

        result = encode.run(plan, self.out_dir, driver=FfmpegDriver(),
                             project_root=FIXTURES, allow_missing=False)

        self.assertTrue(result.aborted)
        self.assertEqual(result.abort_key, "vid-a")
        self.assertEqual(str(result.abort_error), "ffmpeg not found")
        self.assertEqual(result.exit_code, 2)
        entry = result.manifest["jobs"]["vid-a"]
        self.assertEqual(entry["status"], "failed")
        self.assertEqual(entry["reason"], "ffmpeg not found")
        self.assertNotIn("vid-b-720", result.manifest["jobs"])

    def test_missing_ffmpeg_allow_missing_skips_and_continues(self):
        os.environ["PATH"] = str(self.tmp / "empty-bin")
        (self.tmp / "empty-bin").mkdir()
        plan = media_plan.load(PLAN_PATH)

        result = encode.run(plan, self.out_dir, driver=FfmpegDriver(),
                             project_root=FIXTURES, allow_missing=True)

        self.assertFalse(result.aborted)
        self.assertEqual(result.exit_code, 0)
        self.assertEqual(result.counts["skipped"], 2)
        for key in ("vid-a", "vid-b-720"):
            entry = result.manifest["jobs"][key]
            self.assertEqual(entry["status"], "skipped")
            self.assertEqual(entry["reason"], "ffmpeg not found")

    def test_missing_ffprobe_reports_ffprobe_not_ffmpeg(self):
        bin_dir = self.tmp / "ffmpeg-only-bin"
        bin_dir.mkdir()
        shutil.copyfile(FAKE_BIN / "ffmpeg", bin_dir / "ffmpeg")
        os.chmod(bin_dir / "ffmpeg", 0o755)
        os.environ["PATH"] = str(bin_dir)
        plan = media_plan.load(PLAN_PATH)

        result = encode.run(plan, self.out_dir, driver=FfmpegDriver(),
                             project_root=FIXTURES, allow_missing=False)

        self.assertTrue(result.aborted)
        self.assertEqual(str(result.abort_error), "ffprobe not found")
        self.assertEqual(result.exit_code, 2)


# ---------------------------------------------------------------------------
# AC7 — the cache.

class CacheTests(_FakeBinMixin, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.tmp / "project"
        shutil.copytree(FIXTURES / "src", self.project / "src")

    def _run(self, force=False):
        plan = media_plan.load(PLAN_PATH)
        return encode.run(plan, self.out_dir, driver=FfmpegDriver(),
                           project_root=self.project, force=force)

    def test_second_run_is_fully_cached_then_busts_selectively(self):
        r1 = self._run()
        self.assertEqual(r1.counts["encoded"], 2)
        n1 = self._log_len()
        self.assertEqual(n1, 10)  # job A: 6 calls, job B: 4 calls

        # Unchanged inputs: nothing re-encoded, no new subprocess calls.
        r2 = self._run()
        self.assertEqual(r2.counts["cached"], 2)
        self.assertEqual(self._log_len(), n1)

        # mtime change on vid-a's source re-encodes only vid-a (6 more calls).
        src_a = self.project / "src" / "vid-a.mp4"
        st = src_a.stat()
        os.utime(src_a, ns=(st.st_atime_ns, st.st_mtime_ns + 5_000_000_000))
        r3 = self._run()
        self.assertEqual(r3.manifest["jobs"]["vid-a"]["status"], "encoded")
        self.assertEqual(r3.manifest["jobs"]["vid-b-720"]["status"], "cached")
        n3 = self._log_len()
        self.assertEqual(n3, n1 + 6)

        # size change on vid-b-720's source re-encodes only that job (4 more calls).
        src_b = self.project / "src" / "vid-b-720.mp4"
        with src_b.open("ab") as fh:
            fh.write(b"X")
        r4 = self._run()
        self.assertEqual(r4.manifest["jobs"]["vid-b-720"]["status"], "encoded")
        self.assertEqual(r4.manifest["jobs"]["vid-a"]["status"], "cached")
        n4 = self._log_len()
        self.assertEqual(n4, n3 + 4)

        # Deleting a recorded output re-encodes that job alone (6 more calls).
        (self.out_dir / "vid-a.webp").unlink()
        r5 = self._run()
        self.assertEqual(r5.manifest["jobs"]["vid-a"]["status"], "encoded")
        self.assertEqual(r5.manifest["jobs"]["vid-b-720"]["status"], "cached")
        n5 = self._log_len()
        self.assertEqual(n5, n4 + 6)

        # --force re-encodes everything (10 more calls).
        r6 = self._run(force=True)
        self.assertEqual(r6.counts["encoded"], 2)
        self.assertEqual(self._log_len(), n5 + 10)


# ---------------------------------------------------------------------------
# AC9 — determinism.

class DeterminismTests(_FakeBinMixin, unittest.TestCase):
    def test_two_fresh_runs_differ_only_in_encoded_at(self):
        plan = media_plan.load(PLAN_PATH)
        encode.run(plan, self.out_dir, driver=FfmpegDriver(), project_root=FIXTURES, force=True)
        manifest1 = json.loads((self.out_dir / "manifest.json").read_text())

        plan2 = media_plan.load(PLAN_PATH)
        encode.run(plan2, self.out_dir, driver=FfmpegDriver(), project_root=FIXTURES, force=True)
        manifest2 = json.loads((self.out_dir / "manifest.json").read_text())

        def strip(manifest):
            for entry in manifest["jobs"].values():
                self.assertIn("encoded_at", entry)
                entry.pop("encoded_at")
            return manifest

        self.assertEqual(strip(manifest1), strip(manifest2))


# ---------------------------------------------------------------------------
# AC11 — no committed video: .gitignore lines and fixture file sizes.

class RepoHygieneTests(unittest.TestCase):
    def test_gitignore_has_the_two_media_lines(self):
        lines = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
        self.assertIn("build/media/", lines)
        self.assertIn("*.webm", lines)

    def test_fixture_files_are_tiny(self):
        for path in FIXTURES.rglob("*"):
            if not path.is_file():
                continue
            size = path.stat().st_size
            limit = 2048 if path.suffix == ".vtt" else 1024
            self.assertLess(size, limit, f"{path} is {size} bytes (limit {limit})")


# ---------------------------------------------------------------------------
# AC12 — at most two real-ffmpeg-gated tests across the tester's own files.

class SkipUnlessBudgetTests(unittest.TestCase):
    def test_at_most_two_skip_unless_real_ffmpeg(self):
        total = 0
        for name in ("test_encode.py", "test_encode_cli.py"):
            path = TESTS_DIR / name
            if path.exists():
                total += path.read_text(encoding="utf-8").count("skipUnless")
        self.assertLessEqual(total, 2)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
