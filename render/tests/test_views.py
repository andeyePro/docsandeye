"""AC13: Camera table and views."""

import json
import unittest
from pathlib import Path

from docsandeye_render import views


class TestCameraTable(unittest.TestCase):
    """AC13: Camera table, view names, and projections."""

    def setUp(self):
        self.fixtures = Path(__file__).parent.parent / "fixtures"

    def _fixture_camera_table(self):
        """Load camera table from fixtures."""
        path = self.fixtures / "camera-table.json"
        if not path.exists():
            self.skipTest("camera-table.json fixture not found")
        return json.loads(path.read_text(encoding="utf-8"))

    def test_views_table_loaded(self):
        """views.CAMERA_TABLE is loaded from package data."""
        self.assertIsNotNone(views.CAMERA_TABLE)
        self.assertIsInstance(views.CAMERA_TABLE, dict)
        self.assertGreater(len(views.CAMERA_TABLE), 0)

    def test_views_table_has_required_views(self):
        """views.CAMERA_TABLE contains all required views."""
        required_views = {
            "front", "back", "left", "right", "top", "bottom", "iso",
            "front-top-right", "front-top-left"
        }
        self.assertTrue(required_views.issubset(set(views.CAMERA_TABLE.keys())))

    def test_view_names_returns_sorted_list(self):
        """views.view_names() returns sorted list of view names."""
        names = views.view_names()
        self.assertIsInstance(names, list)
        self.assertEqual(names, sorted(names))
        self.assertGreater(len(names), 0)

    def test_is_known_view(self):
        """views.is_known() returns True for known views."""
        self.assertTrue(views.is_known("front"))
        self.assertTrue(views.is_known("iso"))
        self.assertFalse(views.is_known("unknown"))

    def test_view_function(self):
        """views.view() returns table row for known view."""
        row = views.view("front")
        self.assertIsInstance(row, dict)
        self.assertIn("rotx", row)
        self.assertIn("roty", row)
        self.assertIn("rotz", row)
        self.assertIn("projection_dir", row)

    def test_view_function_raises_for_unknown(self):
        """views.view() raises KeyError for unknown view."""
        with self.assertRaises(KeyError):
            views.view("unknown")

    def test_camera_arg_generation(self):
        """views.camera_arg() generates correct gimbal argument."""
        arg = views.camera_arg("front")
        self.assertTrue(arg.startswith("--camera="))
        # Should contain 7 comma-separated values: 0,0,0,rotx,roty,rotz,distance
        parts = arg.replace("--camera=", "").split(",")
        self.assertEqual(len(parts), 7)

    def test_camera_arg_for_iso(self):
        """views.camera_arg() for 'iso' matches specification."""
        arg = views.camera_arg("iso")
        # For iso: rotx=55, roty=0, rotz=25
        self.assertIn("55", arg)
        self.assertIn("25", arg)

    def test_camera_arg_default_distance(self):
        """views.camera_arg() uses default distance 140."""
        arg = views.camera_arg("front")
        self.assertTrue(arg.endswith(",140"))

    def test_camera_arg_custom_distance(self):
        """views.camera_arg() accepts custom distance."""
        arg = views.camera_arg("front", distance=100)
        self.assertTrue(arg.endswith(",100"))

    def test_projection_dir_returns_tuple(self):
        """views.projection_dir() returns tuple for view."""
        proj = views.projection_dir("front")
        self.assertIsInstance(proj, tuple)
        self.assertEqual(len(proj), 3)

    def test_projection_dir_for_front(self):
        """views.projection_dir() for 'front' matches specification."""
        proj = views.projection_dir("front")
        self.assertEqual(proj, (0, -1, 0))

    def test_projection_dir_for_iso(self):
        """views.projection_dir() for 'iso' matches specification."""
        proj = views.projection_dir("iso")
        self.assertEqual(proj, (1, -1, 1))

    def test_default_view_constant(self):
        """views.DEFAULT_VIEW is a known view."""
        self.assertIsNotNone(views.DEFAULT_VIEW)
        self.assertTrue(views.is_known(views.DEFAULT_VIEW))

    def test_nominal_distance_constant(self):
        """views.NOMINAL_DISTANCE is a reasonable value."""
        self.assertIsInstance(views.NOMINAL_DISTANCE, int)
        self.assertGreater(views.NOMINAL_DISTANCE, 0)

    def test_fixture_camera_table_equals_package_table(self):
        """AC13: Package camera table equals fixture camera table."""
        fixture_table = self._fixture_camera_table()
        package_table = views.CAMERA_TABLE

        # Compare the tables
        self.assertEqual(set(fixture_table.keys()), set(package_table.keys()))

        for view_name in fixture_table:
            fixture_row = fixture_table[view_name]
            package_row = package_table[view_name]

            # Compare keys
            self.assertEqual(set(fixture_row.keys()), set(package_row.keys()))

            # Compare rotation values
            for key in ["rotx", "roty", "rotz"]:
                self.assertEqual(fixture_row[key], package_row[key])

            # Compare projection_dir
            self.assertEqual(
                tuple(fixture_row["projection_dir"]),
                tuple(package_row["projection_dir"])
            )
