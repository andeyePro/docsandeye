"""AC1-AC11: Media plan building, encoding pipeline, cache, CLI integration."""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from docsandeye_render.drivers.base import EncoderDriver, EncodeResult, Probe
from docsandeye_render.drivers.ffmpeg import FfmpegDriver
from docsandeye_render.encode import EncodeRunResult, run as encode_run, source_stat
from docsandeye_render.media_plan import MediaJob, MediaPlan, PlanError, load, loads


class TestMediaPlanLoading(unittest.TestCase):
    """AC2: Plan loading (Python) — validates version 1 and raises PlanError."""

    def test_valid_plan_loads(self):
        """A valid media plan loads successfully."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "poster_source": "src/vid-a.jpg",
                    "captions": "src/vid-a.en.vtt",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {
                        "av1_720": "build/media/vid-a-720.webm",
                        "h264_720": "build/media/vid-a-720.mp4",
                        "av1_1080": "build/media/vid-a-1080.webm",
                        "h264_1080": "build/media/vid-a-1080.mp4",
                        "poster": "build/media/vid-a.webp",
                        "captions": "build/media/vid-a.en.vtt",
                    },
                }
            ],
        }
        plan = loads(json.dumps(doc))
        self.assertEqual(plan.version, 1)
        self.assertEqual(len(plan.jobs), 1)
        self.assertEqual(plan.jobs[0].key, "vid-a")

    def test_missing_source_raises_planerror(self):
        """Missing source raises PlanError with field='source'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "poster_source": "src/vid-a.jpg",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {},
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        self.assertEqual(cm.exception.field, "source")

    def test_missing_poster_source_raises_planerror(self):
        """Missing poster_source raises PlanError with field='poster_source'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {},
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        self.assertEqual(cm.exception.field, "poster_source")

    def test_unknown_output_key_raises_planerror(self):
        """Unknown outputs key raises PlanError."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "poster_source": "src/vid-a.jpg",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {"unknown_key": "path/to/output"},
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        self.assertIn("unknown outputs key", str(cm.exception))

    def test_unknown_rendition_raises_planerror(self):
        """Unknown rendition value raises PlanError."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "poster_source": "src/vid-a.jpg",
                    "duration_s": 47,
                    "renditions": [720, 2160],  # 2160 is not allowed
                    "outputs": {},
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        self.assertIn("unknown rendition", str(cm.exception))

    def test_captions_without_outputs_captions_raises_planerror(self):
        """captions set but outputs.captions missing raises PlanError."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "poster_source": "src/vid-a.jpg",
                    "captions": "src/vid-a.en.vtt",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {"av1_720": "out"},
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        self.assertIn("outputs.captions", str(cm.exception))

    def test_outputs_captions_without_captions_raises_planerror(self):
        """outputs.captions set but captions missing raises PlanError."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "poster_source": "src/vid-a.jpg",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {"captions": "build/media/vid-a.en.vtt"},
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        self.assertIn("captions", str(cm.exception))


class FakeEncoderDriver:
    """A fake encoder driver for testing the encode run logic."""

    name = "fake"

    def __init__(self):
        self.calls: list[dict[str, Any]] = []

    def available(self) -> bool:
        return True

    def version(self) -> str | None:
        return "1.0.0"

    def probe(self, source: Path) -> Probe:
        return Probe(width=1920, height=1080, duration_s=47.0)

    def encode(self, job: MediaJob, project_root: Path, out_dir: Path) -> EncodeResult:
        self.calls.append({
            "job_key": job.key,
            "source": str(job.source_path(project_root)),
        })
        # Create the output files so cache tests work
        out_path = Path(out_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        for key in ["av1_720", "h264_720", "av1_1080", "h264_1080", "poster"]:
            path = job.output_path(out_path, key)
            path.write_text("fake content")
        if job.captions:
            captions = job.output_path(out_path, "captions")
            captions.write_text("WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest\n")
        return EncodeResult(
            status="encoded",
            outputs={
                "av1_720": job.output_path(out_path, "av1_720"),
                "h264_720": job.output_path(out_path, "h264_720"),
                "av1_1080": job.output_path(out_path, "av1_1080"),
                "h264_1080": job.output_path(out_path, "h264_1080"),
                "poster": job.output_path(out_path, "poster"),
                **(
                    {"captions": job.output_path(out_path, "captions")}
                    if job.captions
                    else {}
                ),
            },
            skipped_renditions=[],
            poster_mode="convert",
            probe=Probe(width=1920, height=1080, duration_s=47.0),
        )


class TestEncoderSeam(unittest.TestCase):
    """AC3: EncoderDriver protocol — FfmpegDriver satisfies it."""

    def test_ffmpeg_driver_is_encoder_driver(self):
        """FfmpegDriver isinstance of EncoderDriver protocol."""
        driver = FfmpegDriver()
        self.assertIsInstance(driver, EncoderDriver)
        self.assertTrue(hasattr(driver, "name"))
        self.assertTrue(hasattr(driver, "available"))
        self.assertTrue(hasattr(driver, "version"))
        self.assertTrue(hasattr(driver, "probe"))
        self.assertTrue(hasattr(driver, "encode"))

    def test_fake_encoder_driver_is_encoder_driver(self):
        """FakeEncoderDriver satisfies the EncoderDriver protocol."""
        driver = FakeEncoderDriver()
        self.assertIsInstance(driver, EncoderDriver)


class TestSourceStat(unittest.TestCase):
    """AC7: Cache support — source_stat function."""

    def test_source_stat_existing_file(self):
        """source_stat returns size and mtime_ns for existing file."""
        with TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.mp4"
            path.write_text("test content")
            stat = source_stat(path)
            self.assertIsNotNone(stat)
            self.assertIn("size", stat)
            self.assertIn("mtime_ns", stat)
            self.assertGreater(stat["size"], 0)
            self.assertGreater(stat["mtime_ns"], 0)

    def test_source_stat_missing_file_returns_none(self):
        """source_stat returns None for missing file."""
        path = Path("/nonexistent/path/test.mp4")
        stat = source_stat(path)
        self.assertIsNone(stat)


class TestEncodeRun(unittest.TestCase):
    """AC7: Encode run with caching."""

    def setUp(self):
        self.tmpdir = TemporaryDirectory()
        self.path = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_encode_run_with_fake_driver(self):
        """encode_run produces manifest with encoded jobs."""
        # Build a simple plan with one job
        doc = {
            "version": 1,
            "project_root": str(self.path),
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "poster_source": "src/vid-a.jpg",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {
                        "av1_720": "build/media/vid-a-720.webm",
                        "h264_720": "build/media/vid-a-720.mp4",
                        "av1_1080": "build/media/vid-a-1080.webm",
                        "h264_1080": "build/media/vid-a-1080.mp4",
                        "poster": "build/media/vid-a.webp",
                    },
                }
            ],
        }

        # Create source files
        (self.path / "src").mkdir(exist_ok=True)
        (self.path / "src" / "vid-a.mp4").write_text("source")
        (self.path / "src" / "vid-a.jpg").write_text("poster")

        plan = loads(json.dumps(doc))
        driver = FakeEncoderDriver()

        result = encode_run(
            plan,
            self.path / "build" / "media",
            driver=driver,
            project_root=self.path,
        )

        self.assertFalse(result.aborted)
        self.assertEqual(result.counts["encoded"], 1)
        self.assertIn("vid-a", result.manifest["jobs"])
        entry = result.manifest["jobs"]["vid-a"]
        self.assertEqual(entry["status"], "encoded")
        self.assertEqual(entry["driver"], "fake")

    def test_cache_hit_on_second_run(self):
        """Second run with unchanged source is cached."""
        doc = {
            "version": 1,
            "project_root": str(self.path),
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "poster_source": "src/vid-a.jpg",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {
                        "av1_720": "build/media/vid-a-720.webm",
                        "h264_720": "build/media/vid-a-720.mp4",
                        "av1_1080": "build/media/vid-a-1080.webm",
                        "h264_1080": "build/media/vid-a-1080.mp4",
                        "poster": "build/media/vid-a.webp",
                    },
                }
            ],
        }

        (self.path / "src").mkdir(exist_ok=True)
        (self.path / "src" / "vid-a.mp4").write_text("source")
        (self.path / "src" / "vid-a.jpg").write_text("poster")

        plan = loads(json.dumps(doc))
        out_dir = self.path / "build" / "media"
        driver = FakeEncoderDriver()

        # First run
        result1 = encode_run(plan, out_dir, driver=driver, project_root=self.path)
        self.assertEqual(result1.counts["encoded"], 1)
        self.assertEqual(len(driver.calls), 1)

        # Second run — should use cache
        driver2 = FakeEncoderDriver()
        result2 = encode_run(plan, out_dir, driver=driver2, project_root=self.path)
        self.assertEqual(result2.counts["cached"], 1)
        self.assertEqual(len(driver2.calls), 0)  # No new calls

    def test_force_re_encodes(self):
        """--force re-encodes even with cache hit."""
        doc = {
            "version": 1,
            "project_root": str(self.path),
            "jobs": [
                {
                    "key": "vid-a",
                    "media": "vid-a",
                    "source": "src/vid-a.mp4",
                    "poster_source": "src/vid-a.jpg",
                    "duration_s": 47,
                    "renditions": [720, 1080],
                    "outputs": {
                        "av1_720": "build/media/vid-a-720.webm",
                        "h264_720": "build/media/vid-a-720.mp4",
                        "av1_1080": "build/media/vid-a-1080.webm",
                        "h264_1080": "build/media/vid-a-1080.mp4",
                        "poster": "build/media/vid-a.webp",
                    },
                }
            ],
        }

        (self.path / "src").mkdir(exist_ok=True)
        (self.path / "src" / "vid-a.mp4").write_text("source")
        (self.path / "src" / "vid-a.jpg").write_text("poster")

        plan = loads(json.dumps(doc))
        out_dir = self.path / "build" / "media"
        driver = FakeEncoderDriver()

        # First run
        result1 = encode_run(plan, out_dir, driver=driver, project_root=self.path)
        self.assertEqual(result1.counts["encoded"], 1)

        # Second run with --force
        driver2 = FakeEncoderDriver()
        result2 = encode_run(plan, out_dir, driver=driver2, force=True, project_root=self.path)
        self.assertEqual(result2.counts["encoded"], 1)
        self.assertEqual(len(driver2.calls), 1)  # New call made


class TestExitCodes(unittest.TestCase):
    """AC8: Exit codes and summary."""

    def test_exit_code_all_encoded(self):
        """Exit code 0 when all jobs encoded."""
        result = EncodeRunResult(
            manifest={"jobs": {}},
            counts={"encoded": 2, "cached": 0, "skipped": 0, "failed": 0},
        )
        self.assertEqual(result.exit_code, 0)

    def test_exit_code_has_failed(self):
        """Exit code 1 when any job failed."""
        result = EncodeRunResult(
            manifest={"jobs": {}},
            counts={"encoded": 1, "cached": 0, "skipped": 0, "failed": 1},
        )
        self.assertEqual(result.exit_code, 1)

    def test_exit_code_aborted(self):
        """Exit code 2 when aborted."""
        from docsandeye_render.drivers.base import DriverUnavailable
        result = EncodeRunResult(
            manifest={"jobs": {}},
            counts={"encoded": 0, "cached": 0, "skipped": 0, "failed": 0},
            aborted=True,
            abort_error=DriverUnavailable("ffmpeg not found"),
        )
        self.assertEqual(result.exit_code, 2)

    def test_summary_format(self):
        """Summary line has correct format."""
        result = EncodeRunResult(
            manifest={"jobs": {}},
            counts={"encoded": 1, "cached": 2, "skipped": 0, "failed": 1},
        )
        summary = result.summary
        self.assertIn("encoded 1", summary)
        self.assertIn("cached 2", summary)
        self.assertIn("skipped 0", summary)
        self.assertIn("failed 1", summary)


if __name__ == "__main__":
    unittest.main()
