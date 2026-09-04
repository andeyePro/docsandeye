"""AC6: CadQuery driver with fake cadquery module."""

import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock

from docsandeye_render.drivers.cadquery_driver import CadQueryDriver
from docsandeye_render.drivers.base import DriverUnavailable
from docsandeye_render.plan import Job
from docsandeye_render import views


class FakeCadQueryModule:
    """Mock cadquery module for testing."""

    __version__ = "2.4.0"

    # Track calls
    _import_step_calls = []
    _export_calls = []

    class MockShape:
        pass

    class MockAssembly:
        def __init__(self):
            self.shapes = []
            self.saved_path = None
            self.saved_type = None

        def add(self, shape):
            self.shapes.append(shape)
            return self

        def save(self, path, exportType=None):
            self.saved_path = path
            self.saved_type = exportType

    class Importers:
        @staticmethod
        def importStep(path):
            # Record the call
            FakeCadQueryModule._import_step_calls.append(path)
            return FakeCadQueryModule.MockShape()

    class Exporters:
        @staticmethod
        def export(shape, path, exportType=None, opt=None):
            # Record the call
            FakeCadQueryModule._export_calls.append((shape, path, exportType, opt))

    importers = Importers()
    exporters = Exporters()

    @staticmethod
    def Assembly():
        return FakeCadQueryModule.MockAssembly()


class TestCadQueryDriver(unittest.TestCase):
    """AC6: CadQuery driver with fake cadquery module injection."""

    def setUp(self):
        self.tmpdir = TemporaryDirectory()
        self.out_dir = Path(self.tmpdir.name)
        self.fixtures = Path(__file__).parent.parent / "fixtures"

        # Clear fake module call tracking
        FakeCadQueryModule._import_step_calls = []
        FakeCadQueryModule._export_calls = []

    def tearDown(self):
        self.tmpdir.cleanup()
        # Remove fake cadquery from sys.modules after test
        if "cadquery" in sys.modules:
            del sys.modules["cadquery"]

    def _inject_fake_cadquery(self):
        """Inject fake cadquery module into sys.modules."""
        sys.modules["cadquery"] = FakeCadQueryModule()

    def test_cadquery_not_available_when_missing(self):
        """CadQueryDriver.available() returns False when cadquery is not installed."""
        # Ensure cadquery is not available
        if "cadquery" in sys.modules:
            del sys.modules["cadquery"]
        driver = CadQueryDriver()
        self.assertFalse(driver.available())

    def test_cadquery_available_when_present(self):
        """CadQueryDriver.available() returns True when cadquery is injected."""
        self._inject_fake_cadquery()
        driver = CadQueryDriver()
        self.assertTrue(driver.available())

    def test_cadquery_version(self):
        """CadQueryDriver.version() returns cadquery.__version__."""
        self._inject_fake_cadquery()
        driver = CadQueryDriver()
        version = driver.version()
        self.assertEqual(version, "2.4.0")

    def test_cadquery_supports(self):
        """CadQueryDriver.supports() returns True for step -> {stl, svg, glb}."""
        driver = CadQueryDriver()
        self.assertTrue(driver.supports("step", "stl"))
        self.assertTrue(driver.supports("step", "svg"))
        self.assertTrue(driver.supports("step", "glb"))
        self.assertFalse(driver.supports("step", "png"))
        self.assertFalse(driver.supports("scad", "stl"))

    def test_cadquery_unsupported_reason_for_png(self):
        """CadQueryDriver.unsupported_reason() returns reason for step -> png."""
        driver = CadQueryDriver()
        reason = driver.unsupported_reason("step", "png")
        self.assertIsNotNone(reason)
        self.assertIn("png", reason.lower())

    def test_cadquery_svg_render(self):
        """AC6: CadQuery SVG render calls importers.importStep and exporters.export."""
        self._inject_fake_cadquery()
        driver = CadQueryDriver()

        # Create a dummy STEP file
        step_file = self.out_dir / "test.step"
        step_file.write_text("dummy step")

        job = Job(
            key="test-svg",
            component="test",
            design_version="1.0.0",
            render_id="render",
            master_format="step",
            source_files=[str(step_file)],
            parameters={},
            options={"view": "front", "format": "svg"},
            outputs=["test.svg"],
        )

        result = driver.render(job, self.out_dir, self.out_dir)

        self.assertEqual(result.status, "rendered")
        # Check that importStep was called with the source file
        self.assertIn(str(step_file), FakeCadQueryModule._import_step_calls)

        # Check that export was called with SVG parameters
        self.assertEqual(len(FakeCadQueryModule._export_calls), 1)
        _, path, export_type, opt = FakeCadQueryModule._export_calls[0]
        self.assertEqual(export_type, "SVG")
        self.assertIsNotNone(opt)
        self.assertEqual(opt["width"], 1600)
        self.assertEqual(opt["height"], 1200)
        self.assertEqual(opt["marginLeft"], 40)
        self.assertEqual(opt["marginTop"], 40)
        self.assertFalse(opt["showAxes"])
        self.assertEqual(opt["strokeWidth"], 0.5)
        self.assertFalse(opt["showHidden"])
        # Check projection_dir matches camera table for "front"
        self.assertEqual(opt["projectionDir"], views.projection_dir("front"))

    def test_cadquery_stl_render(self):
        """AC6: CadQuery STL render calls importers.importStep and exporters.export."""
        self._inject_fake_cadquery()
        driver = CadQueryDriver()

        # Create a dummy STEP file
        step_file = self.out_dir / "test.step"
        step_file.write_text("dummy step")

        job = Job(
            key="test-stl",
            component="test",
            design_version="1.0.0",
            render_id="render",
            master_format="step",
            source_files=[str(step_file)],
            parameters={},
            options={"format": "stl"},
            outputs=["test.stl"],
        )

        result = driver.render(job, self.out_dir, self.out_dir)

        self.assertEqual(result.status, "rendered")
        # Check that importStep was called
        self.assertIn(str(step_file), FakeCadQueryModule._import_step_calls)

        # Check that export was called with STL type
        self.assertEqual(len(FakeCadQueryModule._export_calls), 1)
        _, _, export_type, opt = FakeCadQueryModule._export_calls[0]
        self.assertEqual(export_type, "STL")

    def test_cadquery_glb_render(self):
        """AC6: CadQuery GLB render calls importers.importStep, Assembly.add, and save."""
        self._inject_fake_cadquery()
        driver = CadQueryDriver()

        # Create a dummy STEP file
        step_file = self.out_dir / "test.step"
        step_file.write_text("dummy step")

        job = Job(
            key="test-glb",
            component="test",
            design_version="1.0.0",
            render_id="render",
            master_format="step",
            source_files=[str(step_file)],
            parameters={},
            options={"format": "glb"},
            outputs=["test.glb"],
        )

        result = driver.render(job, self.out_dir, self.out_dir)

        self.assertEqual(result.status, "rendered")
        # Check that importStep was called
        self.assertIn(str(step_file), FakeCadQueryModule._import_step_calls)

    def test_cadquery_png_render_fails(self):
        """AC6: CadQuery PNG render returns failed status without calling cadquery."""
        self._inject_fake_cadquery()
        driver = CadQueryDriver()

        # Create a dummy STEP file
        step_file = self.out_dir / "test.step"
        step_file.write_text("dummy step")

        job = Job(
            key="test-png",
            component="test",
            design_version="1.0.0",
            render_id="render",
            master_format="step",
            source_files=[str(step_file)],
            parameters={},
            options={"format": "png"},
            outputs=["test.png"],
        )

        result = driver.render(job, self.out_dir, self.out_dir)

        self.assertEqual(result.status, "failed")
        self.assertIsNotNone(result.reason)
        self.assertIn("png", result.reason.lower())

    def test_cadquery_not_available_raises_driver_unavailable(self):
        """CadQueryDriver raises DriverUnavailable when cadquery is not available."""
        # Ensure cadquery is not available
        if "cadquery" in sys.modules:
            del sys.modules["cadquery"]

        driver = CadQueryDriver()

        # Create a dummy STEP file
        step_file = self.out_dir / "test.step"
        step_file.write_text("dummy step")

        job = Job(
            key="test-stl",
            component="test",
            design_version="1.0.0",
            render_id="render",
            master_format="step",
            source_files=[str(step_file)],
            parameters={},
            options={"format": "stl"},
            outputs=["test.stl"],
        )

        with self.assertRaises(DriverUnavailable):
            driver.render(job, self.out_dir, self.out_dir)
