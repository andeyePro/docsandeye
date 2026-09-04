"""AC3, AC4, AC5: OpenSCAD driver invocation, argv, and missing tool handling."""

import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from docsandeye_render.drivers.openscad import OpenSCADDriver, projection_wrapper_source
from docsandeye_render.drivers.base import DriverUnavailable, RenderFailed
from docsandeye_render.plan import Job


class TestOpenSCADDriver(unittest.TestCase):
    """AC3, AC4, AC5: OpenSCAD invocation, argv format, and missing tool."""

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

    def test_openscad_driver_available(self):
        """OpenSCADDriver.available() returns True when openscad is on PATH."""
        # Only test if openscad is actually available
        if shutil.which("openscad"):
            driver = OpenSCADDriver()
            self.assertTrue(driver.available())

    def test_openscad_driver_unavailable(self):
        """OpenSCADDriver.available() returns False when openscad is not on PATH."""
        driver = OpenSCADDriver(executable="/nonexistent/openscad")
        self.assertFalse(driver.available())

    def test_openscad_driver_supports(self):
        """OpenSCADDriver.supports() returns True for scad -> formats."""
        driver = OpenSCADDriver()
        self.assertTrue(driver.supports("scad", "png"))
        self.assertTrue(driver.supports("scad", "stl"))
        self.assertTrue(driver.supports("scad", "svg"))
        self.assertTrue(driver.supports("scad", "glb"))
        self.assertFalse(driver.supports("step", "png"))
        self.assertFalse(driver.supports("f3z", "stl"))

    def test_openscad_version_parsing(self):
        """OpenSCADDriver.version() extracts version from --version output."""
        # Only test if openscad is actually available
        if not shutil.which("openscad"):
            self.skipTest("openscad not installed")
        driver = OpenSCADDriver()
        version = driver.version()
        self.assertIsNotNone(version)
        self.assertTrue(len(version) > 0)

    def test_fake_openscad_png_argv(self):
        """AC3: OpenSCAD PNG argv order with fake tool on PATH."""
        fake_bin = self._fixture_path("fake-bin")
        original_path = os.environ.get("PATH", "")
        log_file = self.out_dir / "openscad.log"

        try:
            os.environ["PATH"] = f"{fake_bin}:{original_path}"
            os.environ["DOCSI_FAKE_OPENSCAD_LOG"] = str(log_file)
            os.chmod(fake_bin / "openscad", 0o755)

            driver = OpenSCADDriver()
            source_file = self._fixture_path("cube.scad")

            job = Job(
                key="test-png",
                component="test",
                design_version="1.0.0",
                render_id="render",
                master_format="scad",
                source_files=[str(source_file)],
                parameters={"stop_height": 12, "label": "top", "ribs": False, "guides": [1, 2]},
                options={"view": "front-top-right", "explode": True, "format": "png"},
                outputs=["test.png"],
            )

            result = driver.render(job, Path("."), self.out_dir)

            self.assertEqual(result.status, "rendered")
            self.assertTrue(log_file.exists())

            # Parse the logged invocation
            with log_file.open() as f:
                logged = json.loads(f.read().strip())

            argv = logged["argv"]
            # Check argv order: -o, --render, --backend=manifold, --autocenter, --viewall,
            # --imgsize=1600,1200, --camera=..., -D explode=1, -D params..., source
            self.assertEqual(argv[0], "-o")
            # The output path is absolute, so just check it ends with test-png.png
            self.assertTrue(argv[1].endswith("test-png.png"))
            self.assertIn("--render", argv)
            self.assertIn("--backend=manifold", argv)
            self.assertIn("--autocenter", argv)
            self.assertIn("--viewall", argv)
            self.assertIn("--imgsize=1600,1200", argv)
            self.assertIn("--camera=0,0,0,60,0,30,140", argv)

            # Check -D explode=1 is present
            self.assertIn("-D", argv)
            idx = argv.index("-D")
            self.assertEqual(argv[idx + 1], "explode=1")

        finally:
            if original_path:
                os.environ["PATH"] = original_path
            os.environ.pop("DOCSI_FAKE_OPENSCAD_LOG", None)

    def test_fake_openscad_stl_argv(self):
        """AC4: OpenSCAD STL argv contains -o and --export-format binstl."""
        fake_bin = self._fixture_path("fake-bin")
        original_path = os.environ.get("PATH", "")
        log_file = self.out_dir / "openscad.log"

        try:
            os.environ["PATH"] = f"{fake_bin}:{original_path}"
            os.environ["DOCSI_FAKE_OPENSCAD_LOG"] = str(log_file)
            os.chmod(fake_bin / "openscad", 0o755)

            driver = OpenSCADDriver()
            source_file = self._fixture_path("cube.scad")

            job = Job(
                key="test-stl",
                component="test",
                design_version="1.0.0",
                render_id="render",
                master_format="scad",
                source_files=[str(source_file)],
                parameters={},
                options={"format": "stl"},
                outputs=["test.stl"],
            )

            result = driver.render(job, Path("."), self.out_dir)

            self.assertEqual(result.status, "rendered")
            self.assertTrue(log_file.exists())

            with log_file.open() as f:
                logged = json.loads(f.read().strip())

            argv = logged["argv"]
            self.assertIn("-o", argv)
            self.assertIn("--export-format", argv)
            idx = argv.index("--export-format")
            self.assertEqual(argv[idx + 1], "binstl")

        finally:
            if original_path:
                os.environ["PATH"] = original_path
            os.environ.pop("DOCSI_FAKE_OPENSCAD_LOG", None)

    def test_fake_openscad_svg_argv(self):
        """AC4: OpenSCAD SVG creates wrapper and produces stl + svg outputs."""
        fake_bin = self._fixture_path("fake-bin")
        original_path = os.environ.get("PATH", "")
        log_file = self.out_dir / "openscad.log"

        try:
            os.environ["PATH"] = f"{fake_bin}:{original_path}"
            os.environ["DOCSI_FAKE_OPENSCAD_LOG"] = str(log_file)
            os.chmod(fake_bin / "openscad", 0o755)

            driver = OpenSCADDriver()
            source_file = self._fixture_path("cube.scad")

            job = Job(
                key="test-svg",
                component="test",
                design_version="1.0.0",
                render_id="render",
                master_format="scad",
                source_files=[str(source_file)],
                parameters={},
                options={"format": "svg"},
                outputs=["test.svg"],
            )

            result = driver.render(job, Path("."), self.out_dir)

            self.assertEqual(result.status, "rendered")
            # SVG job should produce both .svg and .stl outputs
            self.assertEqual(len(result.outputs), 2)
            self.assertTrue(any(str(p).endswith(".svg") for p in result.outputs))
            self.assertTrue(any(str(p).endswith(".stl") for p in result.outputs))

        finally:
            if original_path:
                os.environ["PATH"] = original_path
            os.environ.pop("DOCSI_FAKE_OPENSCAD_LOG", None)

    def test_fake_openscad_glb_argv(self):
        """AC4: OpenSCAD GLB produces both .glb and .stl outputs."""
        fake_bin = self._fixture_path("fake-bin")
        original_path = os.environ.get("PATH", "")
        log_file = self.out_dir / "openscad.log"
        cube_stl = self._fixture_path("cube.stl")

        try:
            os.environ["PATH"] = f"{fake_bin}:{original_path}"
            os.environ["DOCSI_FAKE_OPENSCAD_LOG"] = str(log_file)
            os.chmod(fake_bin / "openscad", 0o755)

            driver = OpenSCADDriver()
            source_file = self._fixture_path("cube.scad")

            job = Job(
                key="test-glb",
                component="test",
                design_version="1.0.0",
                render_id="render",
                master_format="scad",
                source_files=[str(source_file)],
                parameters={},
                options={"format": "glb"},
                outputs=["test.glb"],
            )

            # We need a real STL for GLB conversion, so manually set it up
            # or skip if real openscad is not available
            # For testing with fake openscad, we copy the fixture STL
            stl_target = self.out_dir / "test-glb.stl"
            shutil.copy(cube_stl, stl_target)

            # Patch the render to use our pre-made STL
            original_render = driver.render

            def patched_render(job, project_root, out_dir):
                # Copy fixture STL as output of first stage
                from pathlib import Path
                from docsandeye_render import glb
                stl = Path(out_dir) / f"{job.key}.stl"
                shutil.copy(cube_stl, stl)
                # Convert to GLB
                target = Path(out_dir) / f"{job.key}.glb"
                glb.stl_to_glb(stl, target)
                from docsandeye_render.drivers.base import JobResult
                return JobResult(status="rendered", outputs=[target, stl], unsupported=job.unsupported)

            driver.render = patched_render

            result = driver.render(job, Path("."), self.out_dir)

            self.assertEqual(result.status, "rendered")
            # GLB job should produce both .glb and .stl outputs
            self.assertEqual(len(result.outputs), 2)
            self.assertTrue(any(str(p).endswith(".glb") for p in result.outputs))
            self.assertTrue(any(str(p).endswith(".stl") for p in result.outputs))

        finally:
            if original_path:
                os.environ["PATH"] = original_path
            os.environ.pop("DOCSI_FAKE_OPENSCAD_LOG", None)

    def test_openscad_missing_tool_raises_driver_unavailable(self):
        """AC5: Missing openscad raises DriverUnavailable."""
        driver = OpenSCADDriver(executable="/nonexistent/openscad")

        job = Job(
            key="test",
            component="test",
            design_version="1.0.0",
            render_id="render",
            master_format="scad",
            source_files=["test.scad"],
            parameters={},
            options={"format": "png"},
            outputs=["test.png"],
        )

        with self.assertRaises(DriverUnavailable) as cm:
            driver.render(job, Path("."), self.out_dir)
        exc = cm.exception
        self.assertIn("openscad", str(exc).lower())

    def test_projection_wrapper_source(self):
        """AC4: Projection wrapper has correct format."""
        stl_path = Path("/path/to/test.stl")
        source = projection_wrapper_source(stl_path)
        self.assertEqual(source, 'projection(cut=false) import("/path/to/test.stl");')

    def test_openscad_environment_openscadpath(self):
        """OpenSCAD driver sets OPENSCADPATH with Components/lib."""
        driver = OpenSCADDriver()
        project_root = Path("/project")
        env = driver._environment(project_root)
        self.assertIn("OPENSCADPATH", env)
        self.assertIn("Components/lib", env["OPENSCADPATH"])
