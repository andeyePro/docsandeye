# task_002 — `docsandeye_render`: the Python render pipeline

## Task summary

Build the Python package that turns a render plan (JSON emitted by `@docsandeye/core`, task_001) into rendered artefacts: PNG stills, STL meshes, SVG line-art and GLB models, produced by OpenSCAD for `.scad` masters and by CadQuery/OCP for STEP masters, behind a driver seam so that the package is fully testable with neither tool installed. Renders are cached by the plan's job key so a build in which nothing was bumped renders nothing, and `.f3z` or format-less masters are passed through as hand-exported derived files. The package is stdlib-only (no PyYAML, no pip dependencies): Python 3.11+, `json`, `subprocess`, `hashlib`, `pathlib`, `argparse`, `struct`, `unittest`. It is invoked by the Node CLI (task_004) as `python3 -m docsandeye_render …` and never reads YAML itself.

Environment constraint the spec is honest about: in the build container there is no `openscad`, no `cadquery`, no `pip` and no route to PyPI. All acceptance criteria are verified with fake drivers, committed fixtures and a fake `openscad` executable placed on `PATH`; verification against the real toolchain is a host-side manual test, recorded in the report as unverified here.

## Package layout (this task owns `render/**` only)

```
render/pyproject.toml                    name docsandeye-render, no runtime deps, console script docsandeye-render
render/docsandeye_render/__init__.py     __version__ = "0.1.0"
render/docsandeye_render/__main__.py     argparse CLI
render/docsandeye_render/plan.py         load + validate render-plan.json (version 1); PlanError
render/docsandeye_render/params.py       -D serialisation of parameters
render/docsandeye_render/views.py        the camera table (loaded from render/docsandeye_render/camera-table.json)
render/docsandeye_render/drivers/base.py Driver protocol, JobResult, DriverUnavailable
render/docsandeye_render/drivers/openscad.py
render/docsandeye_render/drivers/cadquery_driver.py
render/docsandeye_render/cache.py        manifest.json read/write, key → outputs, skip logic
render/docsandeye_render/glb.py          pure-Python binary-STL → GLB (single mesh, flat normals, no textures)
render/docsandeye_render/runner.py       orchestrates: plan → driver → cache → report
render/docsandeye_render/camera-table.json   the normative view table below, as data (package data, copied verbatim)
render/tests/                            Tester-owned (immutable once committed)
render/fixtures/                         Generator-owned, see below
```

Fixtures (Generator-owned, `render/fixtures/`):

- `render-plan.json` — a version-1 plan with at least: one `scad` png job with `explode: true` and parameters `{"stop_height": 12, "label": "top", "ribs": false, "guides": [1, 2]}`; one `scad` stl job; one `scad` svg job; one `scad` glb job; one `step` svg job; one `step` glb job; one `f3z` hand-exported job; one `none` hand-exported job.
- `cube.scad` — `cube(10);`.
- `cube.stl` — binary STL of a 10 mm cube with corner at the origin, 12 triangles, right-hand winding, facet normals stored.
- `camera-table.json` — a copy of the normative table below (the Tester compares `views.py`'s table to THIS file, not to `openscad.py`).
- `fake-bin/openscad` — a POSIX `sh` script. Behaviour: if `--version` is among its arguments it prints `OpenSCAD version 2025.03.15` to stderr and exits 0; otherwise it appends one JSON object per invocation, on one line, to the file named by `$DOCSI_FAKE_OPENSCAD_LOG` (`{"argv": [...all arguments after the program name...], "cwd": "<cwd>", "env": {"OPENSCADPATH": "<value or null>"}}`), creates the file named after `-o` with the content `fake-openscad-output`, and exits 0; if `$DOCSI_FAKE_OPENSCAD_FAIL` is set it prints `fake failure` to stderr and exits 1 instead. Committed with mode 100755; every test that uses it must also `os.chmod(path, 0o755)` in `setUp` so a checkout that dropped the mode bit still works.

## Render plan contract (input; defined by task_001, restated here as the consumer)

```json
{"version": 1, "project_root": ".", "jobs": [
  {"key": "electrode-top-stop@2.0.0--topstop-exploded--3f9a1c2b7e4d", "component": "electrode-top-stop",
   "design_version": "2.0.0", "render_id": "topstop-exploded", "master_format": "scad",
   "source_files": ["Components/ElectrodeTopStop/ElectrodeTopStop.scad"], "parameters": {"stop_height": 12},
   "options": {"view": "front-top-right", "explode": true, "annotate": false, "format": "png"},
   "outputs": ["build/render/electrode-top-stop@2.0.0--topstop-exploded--3f9a1c2b7e4d.png"]},
  {"key": "blank-vial-cap@1.0.0--viewer--0000deadbeef", "component": "blank-vial-cap", "design_version": "1.0.0",
   "render_id": "viewer", "master_format": "f3z", "source_files": ["Components/Vial Cap/0 ports/blank_vial_cap.f3z"],
   "parameters": {}, "options": {"format": "glb"}, "status": "hand-exported",
   "outputs": ["Components/Vial Cap/0 ports/blank_vial_cap.step"]}]}
```

Closed sets: `master_format` ∈ `scad | step | f3z | none`; `options.format` ∈ `png | stl | svg | glb`; `options.view` ∈ the camera table keys (default `iso`); `status`, when present, ∈ `hand-exported`. `parameters` values may be `bool`, `int`, `float`, `str`, or a flat list of those; `null`, nested lists and objects are rejected at load. `options.explode: true` adds `-D explode=1`; `options.annotate` is accepted and ignored in v0.1: `annotate` is added to the manifest entry's `unsupported` list iff its value is `true`; an absent or `false` key never adds it. A `parameters` key named `explode` or `annotate` is rejected at load (`PlanError` with `field="parameters.<name>"`, i.e. `parameters.explode` or `parameters.annotate`), so `-D explode=1` is never emitted twice.

Support matrix: OpenSCAD driver: `scad` → `png | stl | svg | glb` (glb = stl then `glb.stl_to_glb`). CadQuery driver: `step` → `stl | svg | glb`; `step` → `png` is unsupported in v0.1 and the job is marked `failed` with `reason: "png from STEP needs cadquery_png_plugin (not in v0.1)"`. `f3z | none` → never rendered (hand-exported).

Camera table (normative; the gimbal form `--camera=0,0,0,<rotx>,<roty>,<rotz>,140` is always combined with `--autocenter --viewall`, so the distance is nominal). `projection_dir` is the CadQuery SVG `projectionDir` for the same view.

| view | rotx | roty | rotz | projection_dir |
|---|---|---|---|---|
| front | 90 | 0 | 0 | [0, -1, 0] |
| back | 90 | 0 | 180 | [0, 1, 0] |
| left | 90 | 0 | 90 | [-1, 0, 0] |
| right | 90 | 0 | 270 | [1, 0, 0] |
| top | 0 | 0 | 0 | [0, 0, 1] |
| bottom | 180 | 0 | 0 | [0, 0, -1] |
| iso | 55 | 0 | 25 | [1, -1, 1] |
| front-top-right | 60 | 0 | 30 | [1, -1, 0.8] |
| front-top-left | 60 | 0 | 330 | [-1, -1, 0.8] |

`-D` serialisation (`params.serialise(name, value)`): `bool` → `true`/`false`; `int`/`float` → `json.dumps(value)`; `str` → double-quoted with `\` and `"` backslash-escaped; list → `[` + comma-joined serialised items + `]`. Result is a single argv entry `-D` followed by `<name>=<serialised>` as the next argv entry (two entries, never one).

## Manifest (output, `build/render/manifest.json`)

```json
{"version": 1, "jobs": {"<key>": {"status": "rendered|cached|hand-exported|skipped|failed", "driver": "openscad|cadquery|none",
   "outputs": ["…"], "rendered_at": "2026-09-04T21:00:00Z", "reason": "only for skipped/failed", "unsupported": ["annotate"]}}}
```

Hand-exported jobs are never cached: every run re-records them fresh with `status: hand-exported`. `OPENSCADPATH` defaults to `<project_root>/Components/lib` prepended to any inherited value; deliberately not configurable in v0.1.

## Acceptance criteria

1. **Plan loading.** `plan.load(path)` returns a `Plan` with typed `Job` objects for the fixture plan and raises `PlanError` — an exception class with attributes `index: int | None`, `field: str | None` and `message: str` — for: a missing `key` (`field="key"`), `version != 1` (`index=None, field="version"`), an unknown `master_format`, an unknown `options.format`, an unknown `options.view`, a job with empty `outputs`, a `parameters` value that is `null`, an object, or a nested list (`field="parameters.<name>"`), and a `parameters` key named `explode` or `annotate`.
2. **Driver seam.** `drivers.base.Driver` is a `typing.Protocol` with `name: str`, `available() -> bool`, `version() -> str | None`, `supports(master_format: str, fmt: str) -> bool` and `render(job, project_root: Path, out_dir: Path) -> JobResult`; `runner.run(plan, out_dir, drivers=[…], force=False, allow_missing=False)` accepts any objects satisfying it, so tests inject a `FakeDriver` that records the jobs it received and writes stub outputs. `JobResult` carries `status`, `outputs`, `reason`, `unsupported`.
3. **OpenSCAD PNG invocation.** With the fixture `fake-bin/openscad` first on `PATH` and `DOCSI_FAKE_OPENSCAD_LOG` set, rendering the fixture `scad` png job invokes exactly one `openscad` process whose logged argv, in order, is: `-o <abs output path>`, `--render`, `--backend=manifold`, `--autocenter`, `--viewall`, `--imgsize=1600,1200`, `--camera=0,0,0,60,0,30,140` (for `front-top-right`, per the table), `-D explode=1`, then one `-D <name>=<value>` pair per `parameters` entry in the plan's key order (`stop_height=12`, `label="top"`, `ribs=false`, `guides=[1,2]`), then the absolute path of the first source file. The logged `env.OPENSCADPATH` starts with `<project_root>/Components/lib`. The manifest entry is `rendered`, `driver: openscad`, `unsupported: []`.
4. **OpenSCAD STL, SVG and GLB.** An `stl` job produces argv containing `-o <key>.stl` and `--export-format binstl`. An `svg` job first renders `<key>.stl` the same way, then writes a temporary wrapper `.scad` whose content is exactly `projection(cut=false) import("<absolute stl path>");`, invokes `openscad -o <key>.svg --render --backend=manifold <wrapper>`, deletes the wrapper, and records BOTH `<key>.svg` and `<key>.stl` in that job's manifest `outputs` (no separate job entry; the wrapper path never appears anywhere in the manifest). A `glb` job renders `<key>.stl` then converts it with `glb.stl_to_glb` into `<key>.glb`, recording both outputs.
5. **Missing tool handling.** With no `openscad` on `PATH` and `allow_missing=False`, the first `scad` job raises `DriverUnavailable`; the runner stops immediately, writes the manifest containing only the jobs processed so far (that job `failed` with `reason: "openscad not found"`; jobs never reached are absent from the manifest), and the CLI prints exactly two lines to stderr — `<key>: openscad not found` then `openscad not found: install OpenSCAD 2024+ (Manifold backend) and ensure it is on PATH` — prints no summary line, and exits 2. With `--allow-missing` every such job is `skipped` with `reason: "openscad not found"`, the run continues, and the exit code follows AC12.
6. **CadQuery driver.** `CadQueryDriver.available()` is `False` when `import cadquery` fails and the driver is skipped without raising. With a fake `cadquery` module injected via `sys.modules` (exposing `importers.importStep`, `exporters.export`, `Assembly` with `add` and `save`), a `step` `svg` job calls `importers.importStep(<abs source>)` once and `exporters.export(shape, <abs out>, exportType="SVG", opt={"width": 1600, "height": 1200, "marginLeft": 40, "marginTop": 40, "showAxes": False, "projectionDir": <tuple from the camera table>, "strokeWidth": 0.5, "showHidden": False})`; a `step` `stl` job calls `exporters.export(shape, <abs out>, exportType="STL")`; a `step` `glb` job calls `Assembly().add(shape)` then `.save(<abs out>, exportType="GLTF")`; a `step` `png` job is marked `failed` with the reason in the support matrix without calling the fake. The exact call arguments are asserted on the fake.
7. **Hand-exported pass-through.** A job with `status: hand-exported` is never sent to a driver; the manifest records `driver: none`, `status: hand-exported`, `outputs` = the job's outputs, and `reason: "f3z has no headless renderer; keep the derived files up to date by hand"` when `master_format` is `f3z` (`reason: "no CAD master; derived files maintained by hand"` for `none`). These entries are rewritten on every run and never reported as `cached`.
8. **Cache skip.** Running the same plan twice with the fake driver renders on the first run and, on the second, invokes no driver for jobs whose key is in the manifest with status `rendered` or `cached` AND whose outputs all exist (they are reported `cached`); if any output file is deleted the job renders again; `force=True` renders everything.
9. **Manifest determinism.** `manifest.json` is written with `sort_keys=True`, `indent=2` and a trailing newline; two runs over the same plan differ only in `rendered_at` values.
10. **STL → GLB.** `glb.stl_to_glb(stl_path, glb_path)` converts the fixture cube into a GLB with: 12-byte header (`glTF`, version 2, total length = file size); a JSON chunk (type `JSON`, padded with `0x20` to a 4-byte boundary) followed by one BIN chunk (type `BIN\0`, padded with `0x00` to a 4-byte boundary), chunk length fields equal to the padded sizes; `asset.version == "2.0"` and `asset.generator` starting with `docsandeye_render`; one mesh with one primitive (mode 4, no indices) whose `POSITION` accessor has `count == 36`, `componentType == 5126`, `type == "VEC3"`, `min == [0,0,0]`, `max == [10,10,10]`, and whose `NORMAL` accessor has `count == 36` and values equal, per triangle, to the unit normal computed from the triangle's right-hand winding (within 1e-6), which for the fixture cube are the six axis unit vectors; both accessors read back through their bufferViews from the BIN chunk with `struct` in the test. Byte-exact expectations beyond these (JSON key order, bufferView layout) are not required.
11. **CLI.** `python3 -m docsandeye_render render --plan <file> --out <dir> [--force] [--allow-missing] [--project-root <dir>]` runs the pipeline and prints a final line `rendered N, cached N, hand-exported N, skipped N, failed N`; `python3 -m docsandeye_render doctor` prints one line per driver — `openscad: found <version>` where `<version>` is the token after `version` in the first line of `openscad --version` output (stdout and stderr combined; with the fake this is `2025.03.15`), or `openscad: not found`; `cadquery: found <cadquery.__version__>` or `cadquery: not found` — and exits 0; `--version` prints `docsandeye_render 0.1.0`.
12. **Per-job failures and exit codes.** Any driver exception other than `DriverUnavailable` (including the fake's non-zero exit, which raises `RenderFailed` carrying the process's stderr) marks that job `failed` with `reason` = the exception message, and the run continues. Final exit code: 2 if the run aborted on `DriverUnavailable` (AC5, whose stderr contract replaces this paragraph's on that path), else 1 if any job is `failed`, else 0. On the non-abort paths the CLI prints one `<key>: <reason>` line per failed job to stderr, then the summary line to stdout.
13. **Tests run stdlib-only.** `python3 -m unittest discover -s render/tests -t render` passes in this container with no third-party modules and no real `openscad`; tests needing the real toolchain are decorated `unittest.skipUnless(shutil.which("openscad"), …)` and there are at most two such tests; the `views.py` table is asserted equal to `render/fixtures/camera-table.json`.

## Out of scope

- No YAML parsing, no reading of component/step files (task_001 emits the plan).
- No exploded-view geometry logic inside `.scad` files (the guide's SCAD sources define `explode`); no annotation/callout rendering (recorded as unsupported).
- No Blender, FreeCAD, TechDraw, Mayo or stl-thumb; no PNG from STEP.
- No video, image optimisation, or poster generation.
- No Node code; no edits outside `render/**`.
- Do not edit `README.md`, `TODO.md`, `CHANGELOG.md`, `.vs/tasks.json`, `.vs/progress.md`.

## Test location

`render/tests/` (stdlib `unittest`, discovered with `python3 -m unittest discover -s render/tests -t render`). Generator scratch tests go under `.vs/cycle-<N>/scratch-tests/` only.

## Proposed budget

3 cycles. Rationale: the seam and cache are straightforward; the GLB writer and exact argv assertions are where a cycle may be lost.

## Model plan

- Generator: **fable** (pre-authorised), ceiling fable. Rationale: building and fully testing a two-toolchain pipeline with neither tool installed, plus a correct binary GLB writer from the spec, is long-horizon work where a weaker tier tends to leave the seam leaky.
- Spec Critic: sonnet. Tester: haiku, ceiling sonnet on test-quality findings.
- Fable rung: **pre-authorised (--fable-subagents)**.
