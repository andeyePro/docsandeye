"""Tester suite for task_011 AC2: `python3 -m docsandeye_render glb <in> <out>`
(`docsandeye_render/convert.py`).

Drives the real subprocess (`sys.executable -m docsandeye_render glb ...`) so
the exact stdout/stderr text and exit codes are what a build log actually
shows, plus a `main()`-level test for the missing-input case. Independence
note: the expected GLB bytes are computed by calling `glb.stl_to_glb`
directly on the fixture cube (the pure conversion function AC2 targets, and
also the mechanism the spec names as ground truth: "identical GLB bytes to
glb.stl_to_glb's output"), never by re-reading whatever the CLI produced.
"""

from __future__ import annotations

import os
import subprocess
import sys
import unittest
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from docsandeye_render.__main__ import main
from docsandeye_render.glb import stl_to_glb

TESTS_DIR = Path(__file__).resolve().parent
RENDER_DIR = TESTS_DIR.parent
FIXTURE_CUBE = RENDER_DIR / "fixtures" / "cube.stl"


class ConvertSubprocessTests(unittest.TestCase):
    """AC2: the real `python3 -m docsandeye_render glb` subcommand."""

    def setUp(self):
        self._tmp_obj = TemporaryDirectory()
        self.tmp = Path(self._tmp_obj.name)

    def tearDown(self):
        self._tmp_obj.cleanup()

    def _run(self, args):
        env = dict(os.environ)
        env["PYTHONPATH"] = str(RENDER_DIR)
        argv = [sys.executable, "-m", "docsandeye_render", "glb", *args]
        return subprocess.run(argv, cwd=str(self.tmp), env=env, capture_output=True, text=True, timeout=60)

    def test_writes_glb_identical_to_stl_to_glb_and_exits_zero(self):
        out_path = self.tmp / "out.glb"
        proc = self._run([str(FIXTURE_CUBE), str(out_path)])

        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stderr, "")
        self.assertTrue(out_path.exists())

        expected_path = self.tmp / "expected.glb"
        stl_to_glb(FIXTURE_CUBE, expected_path)
        self.assertEqual(out_path.read_bytes(), expected_path.read_bytes())

    def test_output_parent_directories_are_created(self):
        out_path = self.tmp / "nested" / "dir" / "out.glb"
        proc = self._run([str(FIXTURE_CUBE), str(out_path)])
        self.assertEqual(proc.returncode, 0)
        self.assertTrue(out_path.exists())

    def test_missing_input_exits_two_with_exact_message(self):
        missing = self.tmp / "does-not-exist.stl"
        out_path = self.tmp / "out.glb"
        proc = self._run([str(missing), str(out_path)])

        self.assertEqual(proc.returncode, 2)
        self.assertEqual(proc.stderr, f"glb: input not found: {missing}\n")
        self.assertEqual(proc.stdout, "")
        self.assertFalse(out_path.exists())

    def test_malformed_stl_input_exits_one(self):
        """A file that exists but is not a usable binary STL: exit 1, not 2."""
        bad = self.tmp / "not-an-stl.stl"
        bad.write_bytes(b"not a binary stl at all, far too short")
        out_path = self.tmp / "out.glb"
        proc = self._run([str(bad), str(out_path)])

        self.assertEqual(proc.returncode, 1)
        self.assertTrue(proc.stderr.startswith("glb: "))
        self.assertFalse(out_path.exists())


class ConvertMainTests(unittest.TestCase):
    """AC2, `main()`-level: the `glb` subcommand is wired into the top-level parser."""

    def setUp(self):
        self._tmp_obj = TemporaryDirectory()
        self.tmp = Path(self._tmp_obj.name)

    def tearDown(self):
        self._tmp_obj.cleanup()

    def _call(self, args):
        stdout_capture = StringIO()
        stderr_capture = StringIO()
        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                code = main(["glb", *args])
        return code, stdout_capture.getvalue(), stderr_capture.getvalue()

    def test_main_missing_input_exits_two_with_exact_message(self):
        missing = self.tmp / "nope.stl"
        out_path = self.tmp / "out.glb"
        code, out, err = self._call([str(missing), str(out_path)])
        self.assertEqual(code, 2)
        self.assertEqual(err, f"glb: input not found: {missing}\n")
        self.assertEqual(out, "")

    def test_main_success_exits_zero_and_writes_identical_bytes(self):
        out_path = self.tmp / "out.glb"
        code, out, err = self._call([str(FIXTURE_CUBE), str(out_path)])
        self.assertEqual(code, 0)
        self.assertEqual(err, "")
        expected_path = self.tmp / "expected.glb"
        stl_to_glb(FIXTURE_CUBE, expected_path)
        self.assertEqual(out_path.read_bytes(), expected_path.read_bytes())


if __name__ == "__main__":
    unittest.main()
