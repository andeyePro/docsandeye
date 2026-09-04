"""AC8, AC9: Cache manifest and determinism."""

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from docsandeye_render import cache


class TestCacheManifest(unittest.TestCase):
    """AC8, AC9: Cache manifest loading, saving, and determinism."""

    def setUp(self):
        self.tmpdir = TemporaryDirectory()
        self.out_dir = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_empty_manifest(self):
        """cache.empty() returns a manifest structure."""
        manifest = cache.empty()
        self.assertEqual(manifest["version"], cache.MANIFEST_VERSION)
        self.assertEqual(manifest["jobs"], {})

    def test_save_manifest(self):
        """AC9: Manifest is saved with sorted keys and 2-space indent."""
        manifest = {
            "version": 1,
            "jobs": {
                "job-a": {"status": "rendered", "driver": "openscad", "outputs": []},
                "job-z": {"status": "rendered", "driver": "openscad", "outputs": []},
            }
        }

        path = cache.save(self.out_dir, manifest)

        self.assertTrue(path.exists())
        content = path.read_text(encoding="utf-8")

        # Check formatting: ends with newline
        self.assertTrue(content.endswith("\n"))

        # Check that keys are sorted (job-a before job-z)
        self.assertLess(content.index("job-a"), content.index("job-z"))

        # Check indentation is 2 spaces
        self.assertIn("  ", content)

    def test_manifest_determinism(self):
        """AC9: Two identical manifests produce identical JSON."""
        manifest1 = {
            "version": 1,
            "jobs": {
                "job-a": {
                    "status": "rendered",
                    "driver": "openscad",
                    "outputs": ["a.png"],
                    "rendered_at": "2026-09-04T21:00:00Z",
                }
            }
        }
        manifest2 = {
            "version": 1,
            "jobs": {
                "job-a": {
                    "status": "rendered",
                    "driver": "openscad",
                    "outputs": ["a.png"],
                    "rendered_at": "2026-09-04T21:00:00Z",
                }
            }
        }

        path1 = cache.save(self.out_dir, manifest1)
        content1 = path1.read_text(encoding="utf-8")

        # Overwrite and save again
        path2 = cache.save(self.out_dir, manifest2)
        content2 = path2.read_text(encoding="utf-8")

        # Contents should be identical
        self.assertEqual(content1, content2)

    def test_load_manifest(self):
        """cache.load() reads manifest from file."""
        manifest = {
            "version": 1,
            "jobs": {
                "test": {"status": "rendered", "driver": "openscad", "outputs": []}
            }
        }
        cache.save(self.out_dir, manifest)

        loaded = cache.load(self.out_dir)
        self.assertEqual(loaded["version"], 1)
        self.assertIn("test", loaded["jobs"])

    def test_load_empty_when_missing(self):
        """cache.load() returns empty manifest when file missing."""
        loaded = cache.load(self.out_dir)
        self.assertEqual(loaded["version"], cache.MANIFEST_VERSION)
        self.assertEqual(loaded["jobs"], {})

    def test_cache_hit_found(self):
        """cache.cache_hit() returns entry when it exists and outputs do."""
        # Create output files
        output1 = self.out_dir / "job-a.png"
        output1.write_text("fake output")

        previous = {
            "version": 1,
            "jobs": {
                "job-a": {
                    "status": "rendered",
                    "driver": "openscad",
                    "outputs": ["job-a.png"],
                }
            }
        }

        hit = cache.cache_hit(previous, "job-a", self.out_dir)
        self.assertIsNotNone(hit)
        self.assertEqual(hit["status"], "rendered")

    def test_cache_miss_missing_output(self):
        """cache.cache_hit() returns None when output file missing."""
        previous = {
            "version": 1,
            "jobs": {
                "job-a": {
                    "status": "rendered",
                    "driver": "openscad",
                    "outputs": ["job-a.png"],
                }
            }
        }

        hit = cache.cache_hit(previous, "job-a", self.out_dir)
        self.assertIsNone(hit)

    def test_cache_miss_not_cached_status(self):
        """cache.cache_hit() returns None for non-cacheable status."""
        previous = {
            "version": 1,
            "jobs": {
                "job-a": {
                    "status": "hand-exported",
                    "driver": "none",
                    "outputs": ["job-a.step"],
                }
            }
        }

        hit = cache.cache_hit(previous, "job-a", self.out_dir)
        self.assertIsNone(hit)

    def test_timestamp_format(self):
        """cache.timestamp() returns ISO format string with Z suffix."""
        ts = cache.timestamp()
        self.assertIsInstance(ts, str)
        self.assertTrue(ts.endswith("Z"))
        # Check basic ISO format
        self.assertRegex(ts, r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
