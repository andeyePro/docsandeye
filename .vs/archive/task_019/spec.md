# task_019 — export follow-up: a tree GitBuilding can build (buildconf.yaml, step links, media links and local asset copy)

## Task summary

task_017 made `docsandeye export` write BuildUp step files, an index and `okh.yml`. Three gaps stop the `buildup/` tree being handed straight to GitBuilding: there is no `buildconf.yaml`; the index links steps as plain Markdown links, so GitBuilding does not see them as steps; and the `## Media` lines name a clip without linking to it. This task closes the three gaps and, for projects hosting media locally, copies the referenced media files into the export tree so the links resolve. The plan stays a pure function of the model; the CLI does the copying.

Decisions already made: keep the lowercase `{qty: N, cat: c}` link form from task_017 (shipped, tested); no part library file (GitBuilding's library schema is not verifiable offline); OKH paths stay repo-relative; Opus generator, Haiku tester.

## Ownership (exhaustive)

Edit: `packages/core/src/export-plan.ts`; `packages/cli/src/export.ts`; `packages/core/fixtures/export-expected/buildup/index.md` and the three `step-*.md` expected files (media lines change); create `packages/core/fixtures/export-expected/buildup/buildconf.yaml`. Create fixture `packages/core/fixtures/export-local/` (see below). `packages/core/src/index.ts` only if a new type needs exporting. Docs: `site/src/content/docs/cli.md` `## export` section, one short paragraph on `buildconf.yaml`, `{step}` links and the media links/copy (additive, keep the existing voice).
Tester-owned: `packages/core/test/export-plan.test.ts` and `packages/cli/test/export.test.ts` (extend; existing tests may be updated only where this spec changes the bytes they assert). Nothing else.

## Plan changes (normative; pure)

1. **`buildconf.yaml`** at `build/export/buildup/buildconf.yaml`, emitted with `emitYaml`, keys in this order, a key omitted when its value is unknown:
   ```
   Title: <project.title | guides[0].title>
   Authors:
     - <project.licensor>
   Affiliation: <project.licensor>
   License: <project.licence>
   ```
   (GitBuilding's documented keys: `Title`, `Authors`, `Affiliation`, `Email`, `License`; `Email` is never written because the model holds no address.) `buildup` gains this entry FIRST, before `index.md`.
2. **Index step links** become GitBuilding step links: `- [<title>](<step-id>.md){step}\n`. Everything else in `index.md` is unchanged.
3. **Media lines** become `- [<media id>](<href>): <type>, recorded <shot_date> with <hero names>` where `<href>` is:
   `resolveMediaUrl(model.config.hosting, manifest.file)` for every provider. For `local` this returns the manifest's `file` unchanged (repo-relative, e.g. `assets/clip-a.mp4`), which is exactly where the CLI copies the file to inside `buildup/`, so the link is relative to the step file; for `url-prefix` (the `aep-like` fixture, base `https://media.example/`) it is the absolute URL.
4. **Asset plan.** `ExportPlan` gains `assets: Array<{ from: string; to: string }>`: for provider `local` only, one entry per DISTINCT `file` value among the media manifests referenced by any exported step (two manifests sharing a `file` yield one entry), `from` = that `file` (repo-relative), `to` = `build/export/buildup/<file>`; sorted by `from`; an empty array (present, not undefined) for other providers. `poster` and `captions` are NOT copied (out of scope).
5. `ExportPlan.version` stays `1` (additive fields). `buildExportPlan` stays synchronous and filesystem-free.

## CLI changes (normative)

After writing the plan files, `runExport` copies each asset whose source exists at `<root>/<from>` to `<root>/<out>/<to minus the build/export/ prefix>` (creating directories; overwriting), counts it, and for each missing source prints to stderr `warning: media file not found: <from>` and continues. Summary line becomes `exported N buildup files, 1 okh manifest, M assets copied` where N counts `buildconf.yaml` too (so the `aep-like` fixture prints `exported 5 buildup files, 1 okh manifest, 0 assets copied`). Exit code 0 even when some assets are missing (the warning is the signal); everything else as task_017.

## Fixture `export-local` (normative)

`packages/core/fixtures/export-local/`: a minimal valid project (config with `guides: [{id: g, title: "Local guide", base: /g}]`, hosting provider `local`, no `project` block; ONE component `widget` with `master_format: none`; ONE step `step-01` with `parts: [{component: widget}]`, `media: [clip-a, clip-b]`; two COMPLETE video manifests modelled field-for-field on `aep-like`'s `vid-005-electrode-seating.yaml` (`type: video`, `file`, `poster`, `captions`, `duration_s`, `shot_date`, `shot_by`, `hero: [widget@<its design_version>]`, `licence`): `clip-a` with `file: assets/clip-a.mp4` and `clip-b` with `file: assets/clip-b.mp4`; an actual small file at `assets/clip-a.mp4` (16 bytes of ASCII text is fine; no poster or caption files are needed unless the loader demands them, check `load.ts`) and NO file for `clip-b`). Every value ASCII; the Generator confirms `loadProject` accepts the fixture with zero problems before writing tests against it.

## Acceptance criteria

1. **buildconf.** For `aep-like`, `buildup/buildconf.yaml` equals the committed expected file byte-for-byte and the Tester hand-derives it (`Title: AEP0.2 build guide`, `Authors:` list with `AMYBO`, `Affiliation: AMYBO`, `License: CERN-OHL-S-2.0`); for the in-memory variant with `project: undefined` it is exactly `Title: Aseptic ElectroPioreactor\n`.
2. **Step links.** Every step line of `index.md` ends with `){step}`; the Tester hand-derives the full `index.md`.
3. **Media links.** For `aep-like` (url-prefix), each media line has href `https://media.example/<file>` exactly as `resolveMediaUrl` returns; the Tester hand-derives `step-05-electrolysis.md` in full again. For `export-local`, the two media lines have hrefs `assets/clip-a.mp4` and `assets/clip-b.mp4`.
4. **Assets.** `buildExportPlan` for `aep-like` returns `assets: []`; for `export-local` returns exactly the two entries, sorted, with `to` under `build/export/buildup/assets/`.
5. **CLI copy.** `docsandeye export --project <copy of export-local>` writes `buildup/assets/clip-a.mp4` byte-identical to the source, does not create `clip-b.mp4`, prints `warning: media file not found: assets/clip-b.mp4` on stderr, prints `exported 3 buildup files, 1 okh manifest, 1 assets copied` (buildconf.yaml, index.md, step-01.md), exits 0. For `aep-like` the summary is `exported 5 buildup files, 1 okh manifest, 0 assets copied` and no warning.
6. **Purity.** `export-plan.ts` still imports no `fs`/`path`; called twice, deep-equal.
7. **No collateral.** 17 pages; full vitest and Python suites green; nothing under `render/**`, `packages/starlight-docsandeye/**`, `examples/**` changes; the only `site/**` change is the `## export` paragraph.
8. **Docs.** cli.md's export section states the three additions in one paragraph, with the summary line updated.

## Out of scope

Part library YAML; copying posters, captions or derived CAD files; `Email`; OKH changes; README/TODO/CHANGELOG (chair).

## Test location

Existing `packages/core/test/export-plan.test.ts` and `packages/cli/test/export.test.ts`, extended. Scratch tests `.vs/cycle-1/scratch-tests/`.

## Proposed budget

2 cycles.

## Model plan

Generator: **opus**. Spec Critic: sonnet. Tester: haiku, ceiling sonnet. Every agent runs vitest in the FOREGROUND (no background tasks, no monitors).
