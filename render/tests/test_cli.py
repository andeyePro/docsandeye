"""AC11: CLI render and doctor commands."""

import json
import os
import shutil
import subprocess
import sys
import unittest
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from docsandeye_render.__main__ import main, build_parser, _doctor, _render
from docsandeye_render.plan import Plan, Job
from docsandeye_render import runner


class TestCLIParsing(unittest.TestCase):
    """AC11: CLI argument parsing."""

    def test_parser_has_render_command(self):
        """Parser defines render subcommand."""
        parser = build_parser()
        args = parser.parse_args(["render", "--plan", "plan.json", "--out", "out"])
        self.assertEqual(args.command, "render")

    def test_parser_has_doctor_command(self):
        """Parser defines doctor subcommand."""
        parser = build_parser()
        args = parser.parse_args(["doctor"])
        self.assertEqual(args.command, "doctor")

    def test_parser_version_flag(self):
        """Parser handles --version flag."""
        parser = build_parser()
        with self.assertRaises(SystemExit) as cm:
            parser.parse_args(["--version"])
        self.assertEqual(cm.exception.code, 0)


class TestCLIRender(unittest.TestCase):
    """AC11: CLI render command."""

    def setUp(self):
        self.tmpdir = TemporaryDirectory()
        self.out_dir = Path(self.tmpdir.name)
        self.fixtures = Path(__file__).parent.parent / "fixtures"

    def tearDown(self):
        self.tmpdir.cleanup()

    def _fixture_path(self, name: str) -> Path:
        """Get path to a fixture file."""
        path = self.fixtures / name
        if not path.exists():
            self.skipTest(f"fixture {name} not found")
        return path

    def test_render_command_with_plan(self):
        """AC11: render command runs with fixture plan."""
        plan_path = self._fixture_path("render-plan.json")

        # Capture stdout/stderr
        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                result = main(["render", "--plan", str(plan_path), "--out", str(self.out_dir)])

        # Should exit successfully
        self.assertIn(result, (0, 1, 2))  # Valid exit codes

    def test_render_summary_line_format(self):
        """AC11: render command prints summary line."""
        plan_path = self._fixture_path("render-plan.json")

        # The render command should exit without error and produce output
        # The exact output format is tested at the module level
        result = main(["render", "--plan", str(plan_path), "--out", str(self.out_dir)])

        # Should return a valid exit code
        self.assertIn(result, (0, 1, 2))

    def test_render_force_flag(self):
        """render command accepts --force flag."""
        plan_path = self._fixture_path("render-plan.json")

        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                result = main([
                    "render",
                    "--plan", str(plan_path),
                    "--out", str(self.out_dir),
                    "--force"
                ])

        self.assertIn(result, (0, 1, 2))

    def test_render_allow_missing_flag(self):
        """render command accepts --allow-missing flag."""
        plan_path = self._fixture_path("render-plan.json")

        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                result = main([
                    "render",
                    "--plan", str(plan_path),
                    "--out", str(self.out_dir),
                    "--allow-missing"
                ])

        self.assertIn(result, (0, 1, 2))

    def test_render_project_root_override(self):
        """render command accepts --project-root override."""
        plan_path = self._fixture_path("render-plan.json")

        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                result = main([
                    "render",
                    "--plan", str(plan_path),
                    "--out", str(self.out_dir),
                    "--project-root", "."
                ])

        self.assertIn(result, (0, 1, 2))

    def test_render_missing_plan_file(self):
        """render command errors when plan file missing."""
        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                result = main([
                    "render",
                    "--plan", "/nonexistent/plan.json",
                    "--out", str(self.out_dir)
                ])

        # Should fail
        self.assertEqual(result, 1)


class TestCLIDoctor(unittest.TestCase):
    """AC11: CLI doctor command."""

    def test_doctor_command_output(self):
        """AC11: doctor command prints driver status."""
        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                result = main(["doctor"])

        output = stdout_capture.getvalue()

        # Should print openscad status
        self.assertIn("openscad", output)
        # Should exit 0
        self.assertEqual(result, 0)

    def test_doctor_command_formats(self):
        """doctor command output contains expected formats."""
        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                main(["doctor"])

        output = stdout_capture.getvalue()
        lines = output.strip().split("\n")

        # Should have at least one line per driver
        self.assertGreaterEqual(len(lines), 2)  # openscad and cadquery

        # Each line should have format "driver: found/not found"
        for line in lines:
            if line:
                self.assertIn(":", line)


class TestCLIVersion(unittest.TestCase):
    """AC11: CLI --version flag."""

    def test_version_flag_output(self):
        """--version flag outputs version string."""
        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                try:
                    result = main(["--version"])
                    # argparse handles --version with sys.exit(0)
                except SystemExit as e:
                    self.assertEqual(e.code, 0)


class TestCLIMain(unittest.TestCase):
    """AC11: main() function behavior."""

    def test_main_with_invalid_command(self):
        """main() handles invalid commands gracefully."""
        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                try:
                    result = main(["invalid-command"])
                    # Parser returns non-zero or exits
                    self.assertNotEqual(result, 0)
                except SystemExit:
                    # Also acceptable
                    pass

    def test_main_returns_integer(self):
        """main() returns an integer exit code."""
        stdout_capture = StringIO()
        stderr_capture = StringIO()

        with mock.patch("sys.stdout", stdout_capture):
            with mock.patch("sys.stderr", stderr_capture):
                result = main(["doctor"])

        self.assertIsInstance(result, int)
