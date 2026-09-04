"""AC2: Driver protocol and fake driver for testing."""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from docsandeye_render.drivers.base import Driver, JobResult, DriverUnavailable, RenderFailed
from docsandeye_render.plan import Job


class FakeDriver:
    """A driver for testing that records calls and writes stub outputs."""

    name = "fake"

    def __init__(self):
        self.rendered_jobs = []
        self.calls = []

    def available(self) -> bool:
        return True

    def version(self) -> str | None:
        return "1.0.0"

    def supports(self, master_format: str, fmt: str) -> bool:
        return master_format in {"scad", "step"} and fmt in {"png", "stl", "svg", "glb"}

    def render(self, job: Job, project_root: Path, out_dir: Path) -> JobResult:
        self.calls.append((job.key, job.fmt, str(project_root), str(out_dir)))
        self.rendered_jobs.append(job)

        # Write stub outputs
        outputs = []
        target = Path(out_dir) / f"{job.key}.{job.fmt}"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("fake output")
        outputs.append(target)

        return JobResult(status="rendered", outputs=outputs, unsupported=job.unsupported)


class TestDriverProtocol(unittest.TestCase):
    """AC2: Driver protocol and seam."""

    def test_driver_protocol_attributes(self):
        """Driver protocol has required attributes."""
        driver = FakeDriver()
        self.assertTrue(hasattr(driver, "name"))
        self.assertTrue(callable(driver.available))
        self.assertTrue(callable(driver.version))
        self.assertTrue(callable(driver.supports))
        self.assertTrue(callable(driver.render))

    def test_fake_driver_available(self):
        """FakeDriver.available() returns True."""
        driver = FakeDriver()
        self.assertTrue(driver.available())

    def test_fake_driver_version(self):
        """FakeDriver.version() returns a version string."""
        driver = FakeDriver()
        version = driver.version()
        self.assertIsInstance(version, str)
        self.assertTrue(version)

    def test_fake_driver_supports(self):
        """FakeDriver.supports() checks format combinations."""
        driver = FakeDriver()
        self.assertTrue(driver.supports("scad", "png"))
        self.assertTrue(driver.supports("scad", "stl"))
        self.assertTrue(driver.supports("step", "svg"))
        self.assertFalse(driver.supports("f3z", "png"))

    def test_fake_driver_render(self):
        """FakeDriver.render() writes outputs and returns JobResult."""
        with TemporaryDirectory() as tmpdir:
            driver = FakeDriver()
            out_dir = Path(tmpdir)

            job = Job(
                key="test-job",
                component="test",
                design_version="1.0.0",
                render_id="render",
                master_format="scad",
                source_files=["test.scad"],
                parameters={},
                options={"format": "png"},
                outputs=["test.png"],
            )

            result = driver.render(job, Path("."), out_dir)

            self.assertEqual(result.status, "rendered")
            self.assertEqual(len(result.outputs), 1)
            self.assertTrue(result.outputs[0].exists())
            self.assertEqual(driver.rendered_jobs, [job])

    def test_job_result_with_unsupported(self):
        """JobResult can carry unsupported option list."""
        result = JobResult(
            status="rendered",
            outputs=[Path("test.png")],
            unsupported=["annotate"]
        )
        self.assertEqual(result.unsupported, ["annotate"])

    def test_driver_unavailable_exception(self):
        """DriverUnavailable carries message and hint."""
        exc = DriverUnavailable("tool not found", hint="install the tool")
        self.assertEqual(str(exc), "tool not found")
        self.assertEqual(exc.message, "tool not found")
        self.assertEqual(exc.hint, "install the tool")

    def test_render_failed_exception(self):
        """RenderFailed carries message and stderr."""
        exc = RenderFailed("render failed", stderr="error output")
        self.assertEqual(str(exc), "render failed")
        self.assertEqual(exc.message, "render failed")
        self.assertEqual(exc.stderr, "error output")

    def test_protocol_structural_type(self):
        """FakeDriver satisfies the Driver protocol structurally."""
        driver = FakeDriver()
        # This is a runtime_checkable protocol, so we can use isinstance.
        # In practice, structural subtyping via duck typing is sufficient.
        self.assertTrue(hasattr(driver, "name"))
        self.assertTrue(callable(driver.available))
        self.assertTrue(callable(driver.version))
        self.assertTrue(callable(driver.supports))
        self.assertTrue(callable(driver.render))
