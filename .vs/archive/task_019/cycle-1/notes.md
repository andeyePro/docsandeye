# task_019 — Generator notes (cycle 1)

Branch `vsss/task_019-export-gitbuilding`, worktree `/workspace/.claude/worktrees/task_019`.

## What changed

- `packages/core/src/export-plan.ts`
  - New `ExportAsset { from, to }` and `ExportPlan.assets: ExportAsset[]` (always present;
    `[]` for every provider but `local`). `version` stays `1` — additive fields only.
  - `buildconfYaml(model)`: `Title`, `Authors` (a one-entry sequence of `project.licensor`),
    `Affiliation`, `License`, each key skipped when the config does not supply it, emitted
    through the existing `emitYaml`. `Email` is never written. Its entry is FIRST in
    `plan.buildup`, before `index.md`.
  - Index step lines are now `- [<title>](<step-id>.md){step}`. Nothing else in `index.md` moved.
  - Media lines are now `- [<id>](<href>): <type>, recorded <date> with <heroes>`, with
    `href = resolveMediaUrl(model.config.hosting, manifest.file)` for EVERY provider —
    one code path, as the revised spec requires (`localProvider.resolve` is the identity, so
    a `local` project links the repo-relative path, which is where the CLI copies the file).
  - `collectAssets`: provider `local` only, one entry per DISTINCT manifest `file` reached by
    an exported step (a `Set`, so two ids sharing a file yield one entry), sorted by `from`,
    `to = build/export/buildup/<file>`. Posters and captions are deliberately not copied.
  - Still imports no `node:fs`/`node:path`/`node:os`/`node:crypto` (`hosting.js` is pure).
- `packages/core/src/index.ts`: export the new `ExportAsset` type (the only reason to touch it).
- `packages/cli/src/export.ts`: after writing the plan's files, copy each asset whose source
  exists at `<root>/<from>` to `<root>/<outputPath(to)>` (mkdir -p, overwrite), counting them;
  a missing source prints `warning: media file not found: <from>` on stderr and continues.
  Summary is now `exported N buildup files, 1 okh manifest, M assets copied`; exit code
  unchanged (0 even with missing sources).
- Fixtures: regenerated the four existing `export-expected/buildup/*.md` from the
  implementation and added `export-expected/buildup/buildconf.yaml`; every changed line
  re-read by hand against the spec (see below). New fixture
  `packages/core/fixtures/export-local/` — `loadProject` reports ZERO problems on it
  (verified before any test was written); `load.ts` never touches media/poster/caption files
  on disk, so only `assets/clip-a.mp4` (16 ASCII bytes) exists and `clip-b.mp4` deliberately
  does not.
- `site/src/content/docs/cli.md`: one additive paragraph in `## export` (buildconf.yaml,
  `{step}` links, media links and the local copy plus its warning), and the summary line in
  the trailing paragraph updated to include `, M assets copied`.

## Hand-check of the regenerated expected bytes

- `buildconf.yaml`: `Title: AEP0.2 build guide` / `Authors:` + `  - AMYBO` / `Affiliation: AMYBO`
  / `License: CERN-OHL-S-2.0` — exactly AC1, key order as specified, single trailing newline.
- `index.md`: only the three step lines changed, each gaining `{step}` after `)`; heading and
  bill of materials byte-identical to before.
- `step-01`, `step-03`, `step-05`: only the `## Media` lines changed, id wrapped as
  `[<id>](https://media.example/<file>)`; `url-prefix` base + the manifest's `file`, as
  `resolveMediaUrl` returns it (no encoding needed — every fixture path is already safe).
- `project: undefined` variant of `aep-like` gives exactly `Title: Aseptic ElectroPioreactor\n`.

## Commands and results

- `npm install` — 407 packages, 0 vulnerabilities.
- `npm run build` — clean.
- `npm run build -w docsandeye-site` — `17 page(s) built`. (The pre-existing
  `missing render/media file … vid-02-fit-the-arm.mp4` warning is unrelated and unchanged.)
- `npm run typecheck` — clean.
- `npx vitest run --root .vs/cycle-1/scratch-tests` — 1 file, 9 tests, all passing
  (AC1 buildconf + ordering + the `project: undefined` variant, AC2 whole hand-derived
  `index.md`, AC3 whole hand-derived `step-05` and the two export-local hrefs, AC4 both
  asset arrays, AC5 both CLI runs including the byte-identical copy, the absent
  `clip-b.mp4` and the stderr warning, AC6 purity + deep-equal on a second call).
- `npx vitest run` (foreground, 84.6 s) — **Test Files 2 failed | 24 passed (26);
  Tests 7 failed | 580 passed (587)**. Every failure is in a Tester-owned file and is on an
  assertion this spec knowingly changes:

  `packages/core/test/export-plan.test.ts` (5) — old un-linked `## Media` line text:
  1. `AC3: BuildUp step files > step-05 has two media entries`
  2. `AC3: BuildUp step files > step-01 media lists hero component`
  3. `AC3: BuildUp step files > step-05 media with multiple heroes`
  4. `AC3: whole-file hand derivations > step-05-electrolysis.md, inline parts and tools plus two media lines`
  5. `AC3: whole-file hand derivations > step-01-print-parts.md, two fallback parts listed tight in declared order`

  `packages/cli/test/export.test.ts` (2) — old buildup count (4, now 5 with `buildconf.yaml`)
  and the old summary line without `, M assets copied`:
  6. `AC7: CLI export command > exports with default --out build/export`
  7. `AC7: CLI export command > prints exact summary line`

  Everything else green, including the byte-for-byte expected-file comparisons in both files
  (`index.md`, the three step files and `okh.yml`), which pass against the regenerated fixtures.
- Python suite: `python3 -m pytest render` reports `No module named pytest` in this container,
  so it could not be run. Nothing under `render/**` was touched, and no Python behaviour is
  reachable from this change.
- `git status` shows changes only in the eight owned paths plus the new `export-local` fixture;
  nothing under `render/**`, `packages/starlight-docsandeye/**` or `examples/**`.

## Decisions

- One resolution path for media hrefs (`resolveMediaUrl` for every provider) because the
  revised spec says so explicitly; the `local` branch is still covered as its own case by the
  `export-local` fixture, so a future non-identity `localProvider.resolve` would be caught.
- Distinctness for `assets` is by `file`, not by manifest id (revised spec item 4), so two ids
  naming one physical clip copy it once.
- `export-local`'s media manifests carry the full `aep-like` video field set minus `in_frame`
  and `narration_source` (which the spec's list omits): `type`, `file`, `poster`, `captions`,
  `duration_s`, `shot_date`, `shot_by`, `hero`, `licence`. `clip-a` is dated 2026-01-02 and
  `clip-b` 2026-01-03 so the two media lines are distinguishable.
- The component is `widget` / name `Widget`, `master_format: none` (hence no `source_files`),
  and the step body says "widget" in lower case, so the part falls through to `## Parts`
  rather than being substituted inline — the fixture exercises media, not substitution.
