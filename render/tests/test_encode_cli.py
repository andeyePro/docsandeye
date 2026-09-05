"""CLI-level tests for ``python3 -m docsandeye_render encode`` and ``doctor``.

These drive the real subprocess (spec AC8), so the exact stdout/stderr text
and exit codes are what a build log actually shows — including the abort
line format required by AC6.  Fixture ``fake-bin`` stands in for ffmpeg /
ffprobe; there is no real ffmpeg in this environment.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
RENDER_DIR = TESTS_DIR.parent
FIXTURES = RENDER_DIR / "fixtures" / "media"
FAKE_BIN = FIXTURES / "fake-bin"
PLAN_PATH = FIXTURES / "media-plan.json"

INSTALL_HINT_LINE = "ffmpeg not found: install ffmpeg 7+ with libsvtav1, libx264, libopus, libwebp"


class EncodeCliTests(unittest.TestCase):
    def setUp(self):
        os.chmod(FAKE_BIN / "ffmpeg", 0o755)
        os.chmod(FAKE_BIN / "ffprobe", 0o755)
        self._tmp_obj = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp_obj.name)
        self.out_dir = self.tmp / "out"
        self.log_path = self.tmp / "ffmpeg.log"

    def tearDown(self):
        self._tmp_obj.cleanup()

    def _run(self, extra_args=(), path_value=None, extra_env=None):
        env = dict(os.environ)
        if path_value is None:
            # Fake-bin first, real PATH behind it: the fixture scripts shell
            # out to `sed`/`printf` for their own JSON-log escaping, so a PATH
            # holding *only* fake-bin breaks that (not the encode itself).
            env["PATH"] = str(FAKE_BIN) + os.pathsep + os.environ.get("PATH", "")
        else:
            # A deliberately restricted PATH for the missing-tool tests: no
            # fallback, so the tool really is absent.
            env["PATH"] = path_value
        env["PYTHONPATH"] = str(RENDER_DIR)
        env["DOCSI_FAKE_FFMPEG_LOG"] = str(self.log_path)
        env.pop("DOCSI_FAKE_FFMPEG_FAIL", None)
        if extra_env:
            env.update(extra_env)
        argv = [
            sys.executable, "-m", "docsandeye_render", "encode",
            "--plan", str(PLAN_PATH), "--out", str(self.out_dir),
            "--project-root", str(FIXTURES), *extra_args,
        ]
        return subprocess.run(argv, cwd=str(self.tmp), env=env,
                               capture_output=True, text=True, timeout=120)

    def test_success_summary_line_and_exit_zero(self):
        proc = self._run()
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout, "encoded 2, cached 0, skipped 0, failed 0\n")
        self.assertEqual(proc.stderr, "")

    def test_missing_ffmpeg_stderr_exact_and_exit_two(self):
        empty_dir = self.tmp / "empty-bin"
        empty_dir.mkdir()
        proc = self._run(path_value=str(empty_dir))
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(
            proc.stderr,
            f"vid-a: ffmpeg not found\n{INSTALL_HINT_LINE}\n",
        )
        self.assertEqual(proc.stdout, "")

    def test_allow_missing_skips_both_jobs_and_exits_zero(self):
        empty_dir = self.tmp / "empty-bin"
        empty_dir.mkdir()
        proc = self._run(extra_args=["--allow-missing"], path_value=str(empty_dir))
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout, "encoded 0, cached 0, skipped 2, failed 0\n")
        self.assertEqual(proc.stderr, "")

    def test_missing_ffprobe_stderr_names_ffprobe(self):
        bin_dir = self.tmp / "ffmpeg-only-bin"
        bin_dir.mkdir()
        shutil.copyfile(FAKE_BIN / "ffmpeg", bin_dir / "ffmpeg")
        os.chmod(bin_dir / "ffmpeg", 0o755)
        proc = self._run(path_value=str(bin_dir))
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(
            proc.stderr,
            "vid-a: ffprobe not found\n"
            "ffprobe not found: install ffmpeg 7+ with libsvtav1, libx264, libopus, libwebp\n",
        )

    def test_failed_encode_reports_per_job_and_exits_one(self):
        proc = self._run(extra_env={"DOCSI_FAKE_FFMPEG_FAIL": "1"})
        self.assertEqual(proc.returncode, 1)
        self.assertEqual(proc.stdout, "encoded 0, cached 0, skipped 0, failed 2\n")
        self.assertEqual(proc.stderr, "vid-a: fake failure\nvid-b-720: fake failure\n")


class DoctorCliTests(unittest.TestCase):
    def setUp(self):
        os.chmod(FAKE_BIN / "ffmpeg", 0o755)
        os.chmod(FAKE_BIN / "ffprobe", 0o755)
        self._tmp_obj = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp_obj.name)

    def tearDown(self):
        self._tmp_obj.cleanup()

    def _run_doctor(self, path_value, prepend_real_path=False):
        env = dict(os.environ)
        if prepend_real_path:
            env["PATH"] = path_value + os.pathsep + os.environ.get("PATH", "")
        else:
            env["PATH"] = path_value
        env["PYTHONPATH"] = str(RENDER_DIR)
        env.pop("DOCSI_FAKE_FFMPEG_LOG", None)
        env.pop("DOCSI_FAKE_FFMPEG_FAIL", None)
        return subprocess.run(
            [sys.executable, "-m", "docsandeye_render", "doctor"],
            cwd=str(self.tmp), env=env, capture_output=True, text=True, timeout=60,
        )

    def test_doctor_reports_found_version_with_fake(self):
        proc = self._run_doctor(str(FAKE_BIN), prepend_real_path=True)
        self.assertEqual(proc.returncode, 0)
        self.assertIn("ffmpeg: found 7.1.1", proc.stdout)

    def test_doctor_reports_not_found_without_fake(self):
        empty_dir = self.tmp / "empty-bin"
        empty_dir.mkdir()
        proc = self._run_doctor(str(empty_dir))
        self.assertEqual(proc.returncode, 0)
        self.assertIn("ffmpeg: not found", proc.stdout)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
