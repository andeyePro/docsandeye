# task_017 — `docsandeye export`: BuildUp Markdown and an Open Know-How manifest

## Task summary

Add the interoperability export the briefing promised: from the loaded model, `docsandeye export` writes (a) BuildUp-flavoured Markdown, one file per step plus an index, with inline part links in BuildUp's `[Name]{qty: N, cat: <cat>}` form, so a guide can be handed to GitBuilding or read as plain Markdown; and (b) `okh.yml`, an Open Know-How manifest assembled only from data the project already holds (a new optional `project:` block in `docsandeye.config.yaml` plus components and derived files), omitting anything unknown rather than inventing it. The plan is a pure, canonical function in core; the CLI writes the files. No network, no new runtime dependencies, no changes to `site/**` or docs pages (Martin is reading them).

Decisions already made: field names were kept BuildUp/OKH-compatible for exactly this; exporters were "Later" until now; Opus generator (settled seams).

## Ownership (exhaustive)

Create: `packages/core/src/export-plan.ts`; `packages/cli/src/export.ts`; `packages/core/fixtures/export-expected/` (the byte-exact expected outputs for the `aep-like` fixture: `buildup/index.md`, `buildup/step-01-print-parts.md`, `buildup/step-03-lid.md`, `buildup/step-05-electrolysis.md`, `okh/okh.yml`).
Edit fixtures (additively; every existing test must stay green): `packages/core/fixtures/aep-like/docsandeye.config.yaml` gains the `project:` block below, whose `title` DIFFERS from the first guide's title so precedence is observable; `packages/core/fixtures/aep-like/docs/steps/step-05-electrolysis.md` body gains, as its new last paragraph, exactly the sentence `Seat the MMO anode (titanium mesh) and check the depth with the Vernier callipers.` so the inline substitution path, regex escaping of `(`/`)` and the tool path are all exercised (no existing core test asserts that step's body).
Edit (additively): `packages/core/src/schemas.ts` (optional `project` block in the config schema), `packages/core/src/index.ts` (exports), `packages/cli/src/bin.ts` (add `export` case and usage line).
Tester-owned: `packages/core/test/export-plan.test.ts`, `packages/cli/test/export.test.ts`. Nothing else.

## Config addition (normative, optional, additive)

```yaml
project:                              # optional; when absent okh.yml is still written with what the model knows
  title: "AEP0.2 build guide"         # NOTE: deliberately not the guide title, so precedence is testable
  description: "An open aseptic electro-bioreactor add-on for the Pioreactor."   # optional
  version: "0.2.0"                    # optional, free string
  licence: "CERN-OHL-S-2.0"           # optional, SPDX-style string; per-component `licence` fields are used for the BOM rows
  licensor: "AMYBO"                   # optional
  repo: "https://github.com/amy-bo/electroPioreactor"   # optional URL
  function: "Grows hydrogen-oxidising bacteria under in-culture electrolysis."  # optional
  documentation_home: "https://docs.electroPioreactor.org/AEP"                 # optional URL
```

The schema is a `z.strictObject` (unlike the other config schemas, which strip unknown keys): `parseConfig` accepts the block (all fields strings; `repo`/`documentation_home` must parse as URLs), defaults to `undefined`, and rejects unknown keys inside it with a `schema` problem at `project.<key>`. Exported type: `ProjectMeta`.

## Export plan (normative; core, pure)

`buildExportPlan(model): ExportPlan` returns `{ version: 1, buildup: Array<{ path: string, content: string }>, okh: { path: 'build/export/okh/okh.yml', content: string } }`, computed only from the model (no filesystem, no clock). Paths are `build/export/buildup/index.md`, `build/export/buildup/<step-id>.md` for every step in `stepsForGuide` order for the FIRST configured guide, then any steps not in that guide in `order`/`id` order ("export order").

BuildUp step file content, exactly:

```
# <title>

<body Markdown with substitutions, see below>

## Parts                      (only when at least one part was NOT substituted inline)

- [<name>]{qty: <qty>, cat: <cat>}          (one bullet per unsubstituted part, one per line, NO blank line between bullets, in the step's declared `parts` order)

## Tools                      (only when at least one tool was NOT substituted inline)

- [<name>]{qty: <qty>, cat: <cat>}          (same: one per line, no blank lines between, in declared `tools` order)

## Media                      (only when the step has media)

- <media id>: <type>, recorded <shot_date> with <hero component names joined by ", ">   (one line per media entry in the step's `media` order)
```

Substitution rules. Entries are processed in the step's `parts` order, then `tools` order. For each entry, the first occurrence in the body of the component's `name` is replaced by `[<name>]{qty: <qty>, cat: <cat>}`, where an occurrence must be: matched LITERALLY (every regex metacharacter in the name escaped — the fixture names contain `(`, `)`, `+`, `.`, `×`), case-sensitive, whole-word (not immediately preceded or followed by `[A-Za-z0-9_]`, so `Lid` does not match `Lidded`), not inside a fenced code block, an inline code span, or an existing Markdown link `[…](…)` / `[…]{…}`, and not overlapping a span already claimed by an earlier substitution. An entry with no such occurrence is listed under `## Parts` (parts) or `## Tools` (tools). Two components with identical `name`: the earlier entry claims the first occurrence, the later one falls through to the list. `qty` is the integer from the step's entry (tools default to 1 as the schema does); `cat` is always the entry's own `cat` field as loaded (tools default to `tool` per the schema; a tool declaring another category keeps it); `name` is the component's `name`; a part naming an unknown component (already a `loadProject` problem) is emitted as `[<component id>]{…}`. Sections (H1, body, `## Parts`, `## Tools`, `## Media`) are separated by exactly one blank line; within a list section bullets are adjacent lines with no blank line between them; files end with exactly one `\n`.

`index.md` content: `# <project.title, else config.guides[0].title>\n\n` then one line per step file `- [<title>](<step-id>.md)\n` in export order, then `\n## Bill of materials\n\n` and one line per component used by any part or tool across all steps, sorted by id: `- [<name>]{qty: <total qty across steps>, cat: <cat of first use>}\n`, where first use = the first entry (parts before tools) of the first step, in export order, that references the component.

`okh.yml` content (OKH v1 key names; keys in this fixed order; a key whose value is unknown is OMITTED entirely, never written empty):

```
okhv: OKH-LOSHv1.0                    # bare: the emitter quoting rule applies to this string too
name: <project.title | guides[0].title>
repo: <project.repo>
version: <project.version>
license:
  hardware: <project.licence>
licensor: <project.licensor>
description: <project.description>
function: <project.function>
documentation-home: <project.documentation_home>
documentation-language: en
bom:                              # one entry per component referenced by any step part or tool, sorted by id
  - name: <name>
    id: <id>
    quantity: <total qty across steps>
    category: <cat of first use, same rule as index.md>
    license: <component.licence>            # omitted when the component has none
    source: <first source_files entry>      # omitted when empty
    export:                                 # omitted when empty; a block sequence (never flow style), one path per line, in derived_files order
      - <derived file path>
manufacturing-files:              # every distinct derived file across referenced components, sorted; omitted when none
  - <path>
```

YAML is written by a small deterministic emitter `emitYaml(value): string` in `export-plan.ts`, not by the `yaml` package's stringify, so output is byte-stable across dependency upgrades. Its doc comment states the supported subset: string, number and boolean scalars; mappings with string keys in insertion order; block sequences of scalars or mappings; 2-space indent; nothing else (no anchors, flow style, comments, multi-line block scalars). Quoting rule: a string is emitted bare unless it is empty, contains a newline (then double-quoted with `\n` escaped), contains `: ` or ` #`, starts or ends with a space, starts with any of `-?:,[]{}#&*!|>'"%@` or a backtick, or would parse as a non-string YAML 1.2 scalar (case-insensitive match of `true|false|yes|no|on|off|null|~`, or numeric-looking such as `1.0`, `0x1F`, `1e3`, `007`); double-quoted strings escape `\` and `"`. Numbers and booleans are emitted bare.

## CLI (normative)

`docsandeye export [--project <root>] [--out <dir>]` (default `--out build/export`): loads the project through the existing `loadProjectSafely`, `formatProblem` and `EXIT` helpers in `packages/cli/src/common.ts` so an invalid project behaves exactly as `render` does (problems printed, exit 1, nothing written), writes every plan file under `<root>/<out>/…` (the plan's `build/export/` prefix replaced by `<out>`) creating directories, prints `exported N buildup files, 1 okh manifest` and exits 0; no project found → 66; `--help` lists `export`. Re-running overwrites; nothing else under `<out>` is touched or deleted.

## Acceptance criteria

1. **Config.** The `project` schema is a `z.strictObject`; `parseConfig` accepts the fixture's block typed as `ProjectMeta`; rejects `project: {repo: "not a url"}` and `project: {title: "x", foo: 1}` with `schema` problems at `project.repo` and `project.foo`; a config without `project` parses with `project` undefined.
2. **Plan purity and determinism.** `buildExportPlan(model)` called twice returns deep-equal results; it is synchronous and takes only the model (no `fs`/`path` import in `export-plan.ts`, asserted by reading the source file in the test).
3. **BuildUp step files.** For the `aep-like` fixture, each emitted step file equals the committed expected file in `packages/core/fixtures/export-expected/buildup/` byte-for-byte. Anti-circularity: the Tester ALSO hand-derives `step-05-electrolysis.md` (inline path) AND `step-01-print-parts.md` (two fallback parts, so the list layout is pinned independently) from the fixture YAML and bodies, without reading the expected files, and asserts equality with the emitted content. Structural assertions: every part appears exactly once as a `[Name]{qty: N, cat: c}` link (inline for `MMO anode (titanium mesh)` and `Vernier callipers` on step-05, under `## Parts`/`## Tools` on steps 01 and 03), `## Media` only on steps with media, one trailing `\n`. Unit cases on the exported substitution helper cover: a name with regex metacharacters; a name inside an existing link and inside a code span (both untouched, so the entry falls to the list); a duplicate-name pair (first entry inline, second listed); whole-word boundaries (`Lid` vs `Lidded`).
4. **Index.** `index.md` equals the expected file; its H1 is `AEP0.2 build guide` (project.title wins over the guide title); the bill of materials lists every referenced component once, sorted by id, with quantities summed across steps. The remainder branch (steps outside the first guide appended in `order`/`id` order) is exercised with an in-memory model variant in which `step-03-lid`'s `guide` is replaced by `['mep']`: it must then be the last step file and index line.
5. **OKH manifest.** `okh.yml` equals the expected file byte-for-byte, and the Tester hand-derives its header (down to `documentation-language`) and its `bom` section from the fixture data and asserts equality. An in-memory variant `{ ...model, config: { ...model.config, project: undefined } }` yields a manifest whose `name` is `Aseptic ElectroPioreactor` and which has NO `repo`, `version`, `license`, `licensor`, `description`, `function`, `documentation-home` keys (asserted on the parsed object); per-component `license` present only for components that declare `licence`.
6. **YAML emitter.** A test feeds `plain`, `a: b`, `x #y`, ` lead`, `trail `, the empty string, `1.0`, `007`, `true`, `no`, `~`, `-dash`, `line1\nline2` and a string containing `"`, asserts the exact emitted form of each, and parses every emitted document back with the `yaml` package to the same values; a nested mapping-in-sequence sample matches the `bom` layout above byte-for-byte.
7. **CLI writes files.** `docsandeye export --project <fixture copy>` writes all plan paths under `build/export/`, prints the exact summary line, exits 0; a second run is byte-identical; `--out custom/dir` relocates the tree; an invalid project exits 1 with nothing written; no project → 66; `--help` lists `export`.
8. **No collateral.** `npm run build` still 17 pages; the full vitest and Python suites stay green; no file under `site/**`, `render/**`, `packages/starlight-docsandeye/**` or `examples/**` changes.
9. **Public surface.** `buildExportPlan`, `ExportPlan`, `emitYaml`, the substitution helper (`substituteBuildUpLinks` or the Generator's name, recorded in `.vs/cycle-N/notes.md`) and the `ProjectMeta` type are exported from `@docsandeye/core`.

## Out of scope

- PDF; GitBuilding `buildconf.yaml`; OKH-LOSH tooling validation (`okh-tool`) beyond parse-back; media/derived-file copying into the export tree; any docs page or README change (chair handles CHANGELOG/TODO).
- Do not edit `README.md`, `TODO.md`, `CHANGELOG.md`, `.vs/tasks.json`, `.vs/progress.md`, `site/**`.

## Test location

`packages/core/test/export-plan.test.ts`, `packages/cli/test/export.test.ts` (vitest). Generator scratch tests under `.vs/cycle-1/scratch-tests/`.

## Proposed budget

3 cycles.

## Model plan

- Generator: **opus**, ceiling fable (settled seams, new module). Spec Critic: sonnet. Tester: haiku, ceiling sonnet.
