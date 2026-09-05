# task_011 — cycle 1 — Generator report (Fable 5.1)

Branch `vsss/task_011-geometry-diff`, worktree `/workspace/.claude/worktrees/task_011`.

## Commits (one per layer)

| SHA | Layer | Files |
|---|---|---|
| `38d985d` | core | `packages/core/src/diff-plan.ts` (new), `packages/core/src/index.ts` |
| `5192e4b` | python | `render/docsandeye_render/convert.py` (new), `render/docsandeye_render/__main__.py` |
| `c510d27` | cli | `packages/cli/src/diff.ts` (new), `packages/cli/src/git.ts`, `packages/cli/src/bin.ts`, `packages/cli/fixtures/diff-repo/build_repo.py` (new) |
| `c263d9f` | plugin + fixtures | `src/{data.ts,virtual.ts,integration.ts,elements/index.ts,styles/docsandeye.css,components/StalenessDetails.astro}`, `src/components/GeometryDiff.astro` (new), `src/elements/docsi-diff.ts` (new), fixtures below, root `.gitignore` |

`package-lock.json` unchanged (`npm install` added nothing). No new runtime dependency.

## Per-AC mapping

| AC | Where | Scratch test |
|---|---|---|
| 1 Core diff plan | `buildDiffPlan(model, staleness)`, `diffCandidates`, `DIFF_PLAN_VERSION`, `OLD_RENDER_OUTPUT_DIR`, `DiffJob`/`DiffPlan` exported from `packages/core/src/index.ts`. aep-like → exactly one job `electrode-top-stop@1.3.0` with `candidates: []`, media `[vid-005-electrode-seating]`. Hand-built job mixes `.stl/.step/.glb` → `[glb, stl]`; jobs sorted by key; media sorted. | `core.scratch.test.ts` (5) |
| 2 Python convert | `convert.py`: `add_glb_parser`, `run_glb`; `__main__.py` adds the `glb` subcommand. Output byte-identical to `glb.stl_to_glb` for `render/fixtures/cube.stl`; missing input → exit 2, stderr `glb: input not found: <path>`; malformed STL → exit 1 `glb: <reason>`. | `test_convert_scratch.py` (4) |
| 3 CLI restore, real git | `diff.ts` `runDiff` + `resolveOldCommit` (the `-G^design_version: <v>$` / `<sha>^` rule), `git.ts` `lastCommitMatching`, `showFileAt`, `existsAt`, `revParse`. Test repo from `fixtures/diff-repo/build_repo.py` (binary STL cube via `struct`; STL edit + bump 1.0.0→1.3.0 in one commit; media pinned to 1.0.0). Restored `.stl` byte-equals the first commit's; fake python3 argv exactly `['-m','docsandeye_render','glb','build/render/old/top-stop@1.0.0.stl','build/render/old/top-stop@1.0.0.glb']`, cwd = repo, PYTHONPATH head = render dir; real python3 → `glTF` header; manifest `status: restored`, `commit` = first sha, sorted keys, 2-space indent, trailing newline. | `cli.scratch.test.ts` AC3 (2) |
| 4 CLI edge cases | `--extras` repo: `no-geom@1.0.0` skipped `no derived .glb or .stl`; `top-stop@0.9.0` skipped `no commit with design_version 0.9.0`; `glb-part@1.0.0` restored by copy with exactly one python call (for the stl job only); second run `cached`; `--force` → `restored`; `.git`-less copy → 4 skipped `not a git repository`, exit 0, python never invoked. | `cli.scratch.test.ts` AC4 (3) |
| 5 Exit and summary | `DOCSI_FAKE_PYTHON_EXIT=1` → job `failed` (`reason: python3 exited 1`), exit 1, summary `restored 1, cached 0, skipped 2, failed 1`; `diff --help` 0, bad option 64, `diff` listed in top-level usage. | `cli.scratch.test.ts` AC5 (2) |
| 6 Plugin markup | `GeometryDiff.astro` + `StalenessDetails.astro` (STALE only, before the changelog list); `data.ts` `oldGeometry`, `oldGeometryFor`, `currentViewerJob` (first sorted key `<component>@<current>--viewer--*` with status rendered/cached/hand-exported); `integration.ts` `collectOldGeometry` copies to `dist/_docsandeye/render/old/`. Fixture site: vid-03-old details carry the exact contract for top-stop 1.0.0→1.3.0 with both figures; `AEP/step-05-topstop/index.html` exists and references the new viewer job; vid-04-old-nogeom details have no `<docsi-diff>`; exactly one `<docsi-diff>` on the page and it sits after vid-02-seat's (CHANGED_IN_FRAME) block. | `plugin.scratch.test.ts` AC6 (3) |
| 7 No-JS legibility | Every figure: `<figcaption>` and `docsi-model > a` in light DOM, no `<script>`. | `plugin.scratch.test.ts` AC7 (1) |
| 8 Element | Registering script defines all five elements incl. `docsi-diff`, 12.5 KB-ish (< 30 KB); `diffLayout(0|1)='single'`, `(2|3)='pair'`; `docsi-diff.ts` 1224 bytes (< 2 KB). | `plugin.scratch.test.ts` AC8 (3) |
| 9 Hygiene | root `npm run build` → 16 pages; root vitest 400/402 (the 2 reds below); python 151 OK (skipped=1); `site` `check --dist` errors 0 / warnings 0; `.gitignore` line appended; fixture placeholders force-added. | see commands |

## Commands and final output lines

```
npx vitest run --config .vs/cycle-1/scratch-tests/vitest.config.ts
  Test Files  3 passed (3)  /  Tests  20 passed (20)          (serial; fileParallelism:false)
python3 .vs/cycle-1/scratch-tests/test_convert_scratch.py
  Ran 4 tests ... OK
cd packages/core && npx vitest run                 Tests  194 passed (194)
cd packages/cli && npm run build && npx vitest run Tests  73 passed (73)
cd render && python3 -m unittest discover -s tests Ran 151 tests ... OK (skipped=1)
npm run build (root)                               [build] 16 page(s) built
cd site && npm run check (docsandeye check --project ../examples/synthetic-guide --dist dist)
                                                   errors: 0, warnings: 0
npx vitest run (root)                              Test Files 1 failed | 18 passed (19); Tests 2 failed | 400 passed (402)
```

The two root failures are both in `packages/starlight-docsandeye/test/build.test.ts` (listed next). Everything else in every existing suite is green.

## Expected-red list (existing tests, not mine to edit)

1. `build.test.ts` › AC10 guide index › "AEP/index.html lists the aep steps…": `expect(items.length).toBe(2)` → now 3 (`step-05-topstop`, title "Fit the top stops", "1 part", after step-02-cap). **Assigned to the Tester by the spec.**
2. `build.test.ts` › AC8 reshoot dashboard › "table rows: top-stop now precedes vial-cap…": `rows[0]` is now `vial-cap`, `rows[1]` `top-stop`. Cause: the spec-mandated fixture `vid-04-old-nogeom` (hero `vial-cap@1.0.0`, STALE) raises vial-cap's `staleHeroCount` from 1 to 2 (`buildReshootIndex` counts every STALE hero pin across all media, sorted by count desc then id), so the tie-break the test describes no longer applies. `rows.length` is still 3; the per-appearance test still passes. **Not in the Tester's literal grant** (route / guide-index counts only) — it is a fixture-count consequence of AC6's own fixture, so I am flagging it for the Evaluator: the minimal fix is to swap the two expected rows (and the test title); the alternative is a different hero for vid-04, which the spec fixes as `vial-cap@1.0.0`.

Both reds appear identically in the `starlight-docsandeye` package run and the root run; `unit.test.ts`, `video.test.ts`, `schema-extension.test.ts`, the core, cli and python suites are green. (Note for the Tester: `build.test.ts` needs `@docsandeye/themes` built — run root `npm run build` first — otherwise `site-pioreactor`'s config fails to load and the whole file errors; that is pre-existing, not from this change.)

## Ambiguity choices

- **`vid-04-old-nogeom` is a photo, not a video.** `video.test.ts` AC3 asserts step-02 has exactly one `details.docsi-stale-video` (vid-03-old) and is not in anyone's grant this task; a second stale *video* on step-02 would break it. The spec fixes the id, step, hero and "no old job" but not the type, so the record is `type: photo` (file `assets/photo/vid-04-old-nogeom.jpg`, a copy of photo-02-cap.jpg). The YAML carries a comment saying why.
- **Skip-reason precedence per job:** not-a-git-repo → no candidates (`no derived .glb or .stl`) → no commit → no candidate committed at the resolved commit (`no derived file committed at <sha7>`, my wording; the spec does not name this case). Reasons are also echoed on stderr as `<key>: <reason>` (mirrors the Python pipeline); the summary line is the only stdout line.
- **`component_file`:** core emits `docs/components/<id>.yaml` (the spec's example); the CLI uses it when it exists and otherwise falls back to `componentFile(root, id)` (`.yml`).
- **`-G` pattern** is passed verbatim as the spec writes it (`^design_version: 1.0.0$`, dots unescaped — a basic-regex `.` matches any char, harmless because the follow-up `git show` content check requires the literal `design_version: <version>`). Git paths are passed as `<rev>:./<path>` so a project root nested inside a larger repository resolves correctly.
- **`cached`** requires the output on disk, the previous manifest entry `restored|cached`, and the same resolved commit; the manifest records the resolved full sha (`<sha>^` is rev-parsed), never the `^` form. The manifest is rewritten from the current plan each run (jobs no longer in the plan drop out); `output` is present for every status, `commit`/`source` only when resolved.
- **`failed` reasons:** `python3 exited <code>` (code 2 also covers "python3 not found", whose message `spawnPython` already prints), `git show failed for <sha7>:<path>`.
- **`.gitignore` line is exactly `build/render/old/` as the spec dictates.** Note for the Evaluator: git anchors a pattern containing a middle slash to the `.gitignore`'s own directory, so this matches only `<repo-root>/build/render/old/` (`git check-ignore` confirms: the fixture path and `examples/synthetic-guide/build/render/old/` are *not* ignored). The existing `build/media/` line has the same anchoring. `**/build/render/old/` would cover nested projects; I kept the literal line because AC9 names it, and force-added the fixture placeholders as instructed (harmless either way).
- **Fixture `top-stop.yaml` untouched** (not in ownership): its `derived_files` stays empty, so the fixture's `build/render/old/manifest.json` is hand-authored (`source: Components/TopStop/TopStop.stl`, a placeholder 40-hex commit) rather than something `docsandeye diff` would produce for that project. Placeholders are copies of the existing 22-byte `glTF{}` stub.
- **`virtual-model.d.ts` and the package-root `index.ts` are not in ownership**, so `StalenessDetails.astro` reads `oldGeometry`/`renderManifest` structurally from the virtual module (as `MediaPane` does for `mediaManifest`), and the new data types/helpers are reachable via `starlight-docsandeye/src/data.ts` (exported by the `./src/*` package export) rather than the package root.
- **`collectOldGeometry` is manifest-driven** (outputs of `restored|cached` jobs), consistent with the other collectors, rather than a directory glob of `build/render/old/*.glb`; the dev-server middleware serves them too.
- **`diff-repo` fixture is a Python script** (`build_repo.py <dir> [--extras] [--first-stl <path>]`, prints `{"first","second","third"}` shas) because the spec asks for an STL "written with `struct`"; it needs only `git` and stdlib. `--extras` adds the AC4 components/media (`glb-part` f3z with a `.glb` derived file, `no-geom`, `vid-04-never` pinned to 0.9.0). Both variants pass `docsandeye check` 0/0.

## Unmet / open

- Nothing in AC1–9 is unmet by the implementation. The only open item is expected-red #2 above (reshoot ordering), which the spec's own fixture forces and which needs a Tester/Evaluator decision.
- Scratch note: the scratch vitest config runs files serially (`fileParallelism: false`); one parallel run had the plugin file's `astro build` fail in `beforeAll` (8 skipped) while the CLI file ran `npm run build`, and passed on re-run — the same class of load-race the existing suites already document.
