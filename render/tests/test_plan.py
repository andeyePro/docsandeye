"""AC1: Plan loading and validation."""

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from docsandeye_render.plan import Plan, Job, PlanError, load, loads


class TestPlanLoading(unittest.TestCase):
    """AC1: Plan loading, validation, and PlanError."""

    def setUp(self):
        self.tmpdir = TemporaryDirectory()
        self.path = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_valid_plan_loads(self):
        """A valid plan with all required fields loads successfully."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test-key",
                    "component": "test-component",
                    "design_version": "1.0.0",
                    "render_id": "test-render",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "parameters": {},
                    "options": {"format": "png"},
                    "outputs": ["test.png"],
                }
            ],
        }
        plan = loads(json.dumps(doc))
        self.assertIsInstance(plan, Plan)
        self.assertEqual(plan.version, 1)
        self.assertEqual(len(plan.jobs), 1)
        self.assertIsInstance(plan.jobs[0], Job)

    def test_missing_key_raises_planerror(self):
        """Missing job key raises PlanError with field='key'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [{"master_format": "scad", "outputs": ["test.png"]}],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "key")
        self.assertEqual(exc.index, 0)

    def test_wrong_version_raises_planerror(self):
        """version != 1 raises PlanError with field='version', index=None."""
        doc = {"version": 2, "project_root": ".", "jobs": []}
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "version")
        self.assertIsNone(exc.index)

    def test_unknown_master_format_raises_planerror(self):
        """Unknown master_format raises PlanError."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "unknown",
                    "outputs": ["out.png"],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "master_format")

    def test_unknown_output_format_raises_planerror(self):
        """Unknown options.format raises PlanError with field='options.format'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "options": {"format": "unknown"},
                    "outputs": ["out.png"],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "options.format")

    def test_unknown_view_raises_planerror(self):
        """Unknown options.view raises PlanError with field='options.view'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "options": {"view": "unknown-view"},
                    "outputs": ["out.png"],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "options.view")

    def test_empty_outputs_raises_planerror(self):
        """Empty outputs list raises PlanError."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "outputs": [],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "outputs")

    def test_null_parameter_raises_planerror(self):
        """null parameter value raises PlanError with field='parameters.<name>'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "parameters": {"param": None},
                    "outputs": ["out.png"],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "parameters.param")

    def test_object_parameter_raises_planerror(self):
        """Object parameter value raises PlanError with field='parameters.<name>'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "parameters": {"param": {"nested": "object"}},
                    "outputs": ["out.png"],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "parameters.param")

    def test_nested_list_parameter_raises_planerror(self):
        """Nested list parameter raises PlanError with field='parameters.<name>'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "parameters": {"param": [1, [2, 3]]},
                    "outputs": ["out.png"],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "parameters.param")

    def test_explode_parameter_raises_planerror(self):
        """Parameter named 'explode' raises PlanError."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "parameters": {"explode": 1},
                    "outputs": ["out.png"],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "parameters.explode")

    def test_annotate_parameter_raises_planerror(self):
        """Parameter named 'annotate' raises PlanError."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "parameters": {"annotate": True},
                    "outputs": ["out.png"],
                }
            ],
        }
        with self.assertRaises(PlanError) as cm:
            loads(json.dumps(doc))
        exc = cm.exception
        self.assertEqual(exc.field, "parameters.annotate")

    def test_load_from_file(self):
        """load(path) reads and parses a plan from file."""
        plan_file = self.path / "plan.json"
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "outputs": ["test.png"],
                }
            ],
        }
        plan_file.write_text(json.dumps(doc))
        plan = load(plan_file)
        self.assertIsInstance(plan, Plan)
        self.assertEqual(plan.path, plan_file)

    def test_job_fmt_property(self):
        """Job.fmt returns format from options or default."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "options": {"format": "stl"},
                    "outputs": ["test.stl"],
                }
            ],
        }
        plan = loads(json.dumps(doc))
        self.assertEqual(plan.jobs[0].fmt, "stl")

    def test_job_view_property(self):
        """Job.view returns view from options or default."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "options": {"view": "front"},
                    "outputs": ["test.png"],
                }
            ],
        }
        plan = loads(json.dumps(doc))
        self.assertEqual(plan.jobs[0].view, "front")

    def test_job_explode_property(self):
        """Job.explode returns True when options.explode is True."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "options": {"explode": True},
                    "outputs": ["test.png"],
                }
            ],
        }
        plan = loads(json.dumps(doc))
        self.assertTrue(plan.jobs[0].explode)

    def test_job_annotate_property(self):
        """Job.annotate returns True when options.annotate is True."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "options": {"annotate": True},
                    "outputs": ["test.png"],
                }
            ],
        }
        plan = loads(json.dumps(doc))
        self.assertTrue(plan.jobs[0].annotate)

    def test_job_unsupported_includes_annotate(self):
        """Job.unsupported includes 'annotate' when annotate is True."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "scad",
                    "source_files": ["test.scad"],
                    "options": {"annotate": True},
                    "outputs": ["test.png"],
                }
            ],
        }
        plan = loads(json.dumps(doc))
        self.assertIn("annotate", plan.jobs[0].unsupported)

    def test_job_hand_exported_property(self):
        """Job.hand_exported returns True when status is 'hand-exported'."""
        doc = {
            "version": 1,
            "project_root": ".",
            "jobs": [
                {
                    "key": "test",
                    "master_format": "f3z",
                    "status": "hand-exported",
                    "outputs": ["test.step"],
                }
            ],
        }
        plan = loads(json.dumps(doc))
        self.assertTrue(plan.jobs[0].hand_exported)
