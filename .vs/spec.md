# task_011 — v0.3 first slice: "what changed" geometry, old vs new side by side

## Task summary

Give the stale-video "what changed" panel its geometry. For every STALE media record (CHANGED_IN_FRAME diffs are a later slice), the build restores the changed component's derived geometry as it was at the recorded version (`shot_with`) from git history, converts it to GLB with the existing pure-Python converter, and the plugin shows it beside the current model in a `<docsi-diff>` element (two `<docsi-model>` viewers labelled with the two versions) inside the staleness details, with a no-JavaScript fallback of two download links. The red/green/grey overlay from the briefing stays out of scope (it needs a mesh boolean the container cannot run); this slice delivers the side-by-side presentation the briefing lists as the alternative, on the same data path the overlay will later use.

Decisions already made: old geometry comes from git at the recorded version, never from a separate archive; renders are cached by `<component>@<version>`; everything readable without JavaScript; no new runtime dependencies; Fable only where it clearly beats Opus.

## Ownership (exhaustive)

Create: `packages/core/src/diff-plan.ts`; root `.gitignore` (append one line `build/render/old/`); `packages/cli/src/diff.ts`; `render/docsandeye_render/convert.py` (a `glb` subcommand wrapper around `glb.stl_to_glb`); `packages/starlight-docsandeye/src/elements/docsi-diff.ts`, `src/components/GeometryDiff.astro`; fixtures: `packages/starlight-docsandeye/fixtures/project/build/render/old/**` (a manifest plus placeholder `.glb` files under 1 KB), a NEW fixture step `fixtures/project/docs/steps/step-05-topstop.md` (guide `aep`, order 5, `viewer: {component: top-stop, format: glb}`, one part `top-stop`) and `fixtures/project/build/render/manifest.json` plus a placeholder `.glb` for the `top-stop@1.3.0--viewer--<hash>` job (hash computed with core's `renderJobKey`), `packages/cli/fixtures/diff-repo/` (a script that builds a temporary git repository, not a committed repo).
Edit (additively): `packages/core/src/index.ts`; `render/docsandeye_render/__main__.py` (add `glb` subcommand); `packages/cli/src/bin.ts` (add `diff`); `packages/cli/src/git.ts` (new helpers); `packages/starlight-docsandeye/src/{data.ts,virtual.ts,integration.ts,components/StalenessDetails.astro,elements/index.ts,styles/docsandeye.css}`.
Tester-owned: `packages/core/test/diff-plan.test.ts`, `packages/cli/test/diff.test.ts`, `render/tests/test_convert.py`, `packages/starlight-docsandeye/test/diff.test.ts`, and the existing `packages/starlight-docsandeye/test/build.test.ts` ONLY for assertions that count fixture routes or guide-index entries (the new `step-05-topstop` adds one `aep` step: the guide index gains one link, `AEP/step-05-topstop/` exists, sidebar gains one entry; the Tester updates exactly those expectations and nothing else). Nothing else.

## Diff plan (normative; core emits `build/diff-plan.json`)

```json
{"version": 1, "jobs": [
  {"key": "top-stop@1.0.0", "component": "top-stop", "version": "1.0.0", "current": "1.3.0",
   "component_file": "docs/components/top-stop.yaml",
   "candidates": ["Components/ElectrodeTopStop/ElectrodeTopStop.glb", "Components/ElectrodeTopStop/ElectrodeTopStop.stl"],
   "output": "build/render/old/top-stop@1.0.0.glb", "media": ["vid-03-old"]}]}
```

One job per distinct `(component, shot_with)` pair across the `stale_heroes` records of STALE media (only); `candidates` = the component's `derived_files` filtered to `.glb` first then `.stl` (both lists in their original order; other extensions ignored); a component with no `.glb`/`.stl` derived file yields a job with `candidates: []`. Jobs sorted by key.

## CLI `docsandeye diff` (normative)

`docsandeye diff [--project <root>] [--force]`: writes the plan, then for each job: (1) find the commit where the component file last carried the old version: `git log -1 --format=%H -G^design_version: <version>$ -- <component_file>` (the `-G` pattern is one argv element with NO surrounding quotes — `execFile`, no shell; it relies on component YAML writing the bare unquoted value, which core's own fixtures and `init` template do) gives the commit that changed away from it (or introduced it); take `<sha>^` if `git show <sha>^:<component_file>` succeeds and its output contains `design_version: <version>` (a failing `git show`, e.g. a root commit, counts as not containing), else `<sha>` itself if that contains it; if neither, the job is `skipped` with `reason: "no commit with design_version <version>"`; (2) for the first candidate that exists at that commit (`git cat-file -e <commit>:<path>`), `git show <commit>:<path> > build/render/old/<key>.<ext>`; (3) if `.stl`, run `python3 -m docsandeye_render glb <stl> <output>` (same PYTHONPATH rule as `render`); if `.glb`, copy; (4) write `build/render/old/manifest.json` `{"version": 1, "jobs": {"<key>": {"status": "restored|cached|skipped|failed", "commit": "<sha>", "source": "<candidate>", "output": "...", "reason": "…"}}}` (sorted keys, 2-space indent, trailing `\n`); a job is `cached` when its output exists and `commit` matches unless `--force`. Exit 0, or 1 if any job `failed`; `git` absent or not a repository → every job `skipped` with `reason: "not a git repository"` and exit 0; the summary line `restored N, cached N, skipped N, failed N`.

## Plugin (normative)

`loadDocsandeyeData` gains `oldGeometry` = the old manifest or `null`. In `StalenessDetails.astro` (STALE media only), for each `stale_heroes` record whose old-manifest job is `restored|cached`, render before the changelog list:

```html
<docsi-diff data-component="top-stop" data-old="1.0.0" data-new="1.3.0">
  <figure class="docsi-diff-old"><figcaption>Recorded with v1.0.0</figcaption><docsi-model data-src="/_docsandeye/render/old/top-stop@1.0.0.glb"><a href="/_docsandeye/render/old/top-stop@1.0.0.glb">Download the old 3D model</a></docsi-model></figure>
  <figure class="docsi-diff-new"><figcaption>Current v1.3.0</figcaption><docsi-model data-src="/_docsandeye/render/top-stop@1.3.0--viewer--<hash>.glb"><a href="…">Download the current 3D model</a></docsi-model></figure>
</docsi-diff>
```

The current model's GLB is found by scanning the render manifest for a job whose key starts with `<component>@<current>--viewer--` with status `rendered|cached|hand-exported` (any step); when none exists the new figure is omitted and `data-new` still carries the version. The copy step copies `build/render/old/*.glb` to `dist/_docsandeye/render/old/`. `docsi-diff.ts` only lays the two figures side by side (a class added on upgrade drives a CSS grid); camera linking is out of scope (`docsi-model` exposes no viewer API). It exports the pure helper `diffLayout(count: number): 'single' | 'pair'` for the unit test. The JS is under 2 KB.

## Acceptance criteria

1. **Core diff plan.** `buildDiffPlan(model, staleness)` returns the schema above; the `aep-like` fixture yields exactly the distinct STALE hero pairs; candidates ordered glb-first (the hand-built test job mixes `.stl`, `.step` and `.glb` derived files to exercise the ordering and the filter); jobs sorted; exported from the package entry.
2. **Python convert.** `python3 -m docsandeye_render glb <in.stl> <out.glb>` writes a GLB identical to `glb.stl_to_glb`'s output for the fixture cube and exits 0; a missing input exits 2 with `glb: input not found: <path>`.
3. **CLI restore, real git.** In a temporary repository built by the test (component YAML at 1.0.0 with a committed well-formed BINARY `.stl` derived file — a 12-triangle cube written by the test with `struct`, then the STL edited and the version bumped to 1.3.0 in one commit, then a media manifest pinned to 1.0.0), `docsandeye diff` writes `build/render/old/top-stop@1.0.0.stl` whose bytes equal the FIRST commit's STL, produces the `.glb` (via the fake `python3` in the existing CLI fixtures the test asserts the exact argv; via the real python3 when available it asserts the GLB header `glTF`), and writes the manifest with `status: restored` and the first commit's sha.
4. **CLI edge cases.** No candidate → `skipped` with `reason: "no derived .glb or .stl"`; version never committed → `skipped` with the stated reason; non-git directory → all `skipped`, exit 0; second run → `cached`; `--force` → restored again; a `.glb` candidate is copied without invoking python.
5. **Exit and summary.** Summary line exact; exit 1 iff any job `failed` (simulate with the fake python3 exiting 1).
6. **Plugin markup.** In the fixture site, `AEP/step-02-cap/index.html`'s `vid-03-old` details contain the `<docsi-diff>` contract for `top-stop` 1.0.0 → 1.3.0 with both figures (the fixture gains `build/render/old/manifest.json` with a restored job and a placeholder `.glb`, plus the `step-05-topstop` viewer job in the render manifest with its placeholder `.glb`), the old `.glb` is copied to `dist/_docsandeye/render/old/`, and `AEP/step-05-topstop/index.html` exists; a second fixture STALE record whose component has no old job (add `vid-04-old-nogeom` on step-02 with hero `vial-cap@1.0.0` and no old-manifest entry) renders its details without any `<docsi-diff>`; CHANGED_IN_FRAME media render no `<docsi-diff>`.
7. **No-JS legibility.** Each figure's light DOM contains the download link with the exact text; no figure depends on JavaScript to show its caption.
8. **Element.** The registering script defines `docsi-diff` and stays under the existing 30 KB limit (the Tester leaves the two existing size assertions unchanged); `diffLayout` is unit-tested.
9. **Hygiene.** Root `npm run build` (16 pages), full vitest, Python suite, `check --dist` 0/0 green; no new runtime dependency; root `.gitignore` gains the line `build/render/old/` (restored geometry is never committed); the fixture's placeholder files under `fixtures/project/build/render/old/` are force-added like the other fixture build outputs.

## Out of scope

- The red/green/grey overlay and any mesh boolean or hashing (`trimesh`); the `trimesh` guard gate.
- Restoring `.scad`/`.step` sources and re-rendering them (only committed derived files are restored in this slice; a later slice can run the render pipeline on restored sources).
- Camera linking (no viewer API exists); CHANGED_IN_FRAME diffs.
- Do not edit `README.md`, `TODO.md`, `CHANGELOG.md`, `.vs/tasks.json`, `.vs/progress.md`, `site/**`, `examples/**`, `packages/themes/**`.

## Test location

`packages/core/test/diff-plan.test.ts`, `packages/cli/test/diff.test.ts`, `render/tests/test_convert.py`, `packages/starlight-docsandeye/test/diff.test.ts`. Generator scratch tests under `.vs/cycle-1/scratch-tests/`.

## Proposed budget

3 cycles.

## Model plan

- Generator: **fable** — four layers (core, Python, CLI with real git, plugin with fixtures) in one coherent slice; Opus tends to leave one seam inconsistent on this shape. Spec Critic: sonnet. Tester: sonnet (git-in-the-loop and build-in-the-loop suites).
