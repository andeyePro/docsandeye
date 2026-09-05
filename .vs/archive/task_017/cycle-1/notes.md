# task_017 cycle 1 — Generator notes

## Exported substitution helper

`substituteBuildUpLinks(body: string, refs: readonly BuildUpRef[]): BuildUpSubstitution`
— exported from `@docsandeye/core` (source: `packages/core/src/export-plan.ts`).

- `BuildUpRef` = `{ name: string; qty: number; cat: string }` (`name` is the component's
  `name`, or the component id when the reference is unknown).
- `BuildUpSubstitution` = `{ body: string; inlined: boolean[] }`; `inlined` is parallel to
  the `refs` array — `true` means that ref was substituted inline, `false` means it must be
  listed under `## Parts` / `## Tools`.
- Refs are passed as one array, parts first then tools, so "earlier entry claims the first
  occurrence" is just array order.

Companion export: `buildUpLink(ref)` → `` `[<name>]{qty: <qty>, cat: <cat>}` ``.

Other new public surface: `buildExportPlan`, `emitYaml`, `EXPORT_OUTPUT_DIR`,
`EXPORT_PLAN_VERSION`, types `ExportPlan`, `ExportFile`, `BuildUpRef`,
`BuildUpSubstitution`, `YamlValue`/`YamlMapping`/`YamlScalar`, plus `ProjectMetaSchema`
and the `ProjectMeta` type from `schemas.ts`.

## Spec ambiguities and how they were resolved

1. **`okhv` quoting.** The spec's okh.yml template writes `okhv: "OKH-LOSHv1.0"` with
   quotes, but the normative quoting rule for `emitYaml` (the sole writer of okh.yml)
   emits that string bare: it is not empty, has no newline, no `: `, no ` #`, no leading
   or trailing space, does not start with a special character and is not a non-string
   YAML 1.2 scalar. **Resolved: `okhv: OKH-LOSHv1.0` (bare).** Quoting it would have
   required a special case that contradicts the emitter's own rule and AC6. If the Tester
   hand-derives the header with quotes, this is the one byte-level disagreement to settle.
2. **`emitYaml` on a root scalar.** The spec's AC6 feeds bare strings to the emitter and
   also parses "every emitted document" back. A YAML document ends with a newline, so
   `emitYaml('plain') === 'plain\n'` and `emitYaml({v: 'plain'}) === 'v: plain\n'`. Both
   round-trip through the `yaml` package.
3. **A string containing (but not starting with) `"`.** The quoting rule lists only
   *starts with* `"` as a trigger, so `say "hi"` is emitted bare — it is a legal YAML plain
   scalar and round-trips. The escape clause (`\` and `"`) applies to strings that are
   quoted for one of the listed reasons.
4. **`project.<key>` problem path for unknown keys.** zod 4.5 reports `unrecognized_keys`
   with `path: ['project']` and the offending names in `issue.keys`, which would have
   produced a problem at `project`, not `project.foo`. `zodProblems` in `schemas.ts` now
   expands such an issue into one problem per key at `<object path>.<key>`, message
   `unrecognized key "foo"`. No other schema is strict, so nothing else changes.
5. **All `project` fields optional.** AC1 requires `project: {repo: "not a url"}` to be
   rejected *at* `project.repo`; a required `title` would add a second problem. Every field
   is therefore `.optional()`, and plain `z.string()` (not the codebase's `nonEmptyString`)
   since the spec says only "all fields strings".
6. **Media entries with no manifest.** The spec pins the `## Media` line format but not the
   unresolvable case (already a `loadProject` problem). Resolved: skip the entry; if a step
   has media but none resolve, the section is omitted.
7. **Unknown hero pin.** A hero pin naming an unknown component contributes the component
   id (the pin without `@version`) in place of a name, mirroring the spec's rule for parts.
8. **Unknown component in `parts`/`tools`.** Emitted as `[<component id>]{…}` per the spec,
   and it also appears in the bill of materials and the OKH `bom` (with `name` = the id and
   no `license`/`source`/`export`, since there is no component record to read).
9. **`N` in the CLI summary.** `exported N buildup files, 1 okh manifest` counts every file
   in `plan.buildup`, i.e. `index.md` plus one per step (`N = 4` for the `aep-like` fixture).
10. **Body whitespace.** The step body is `trim()`-ed before substitution, so the H1, body
    and each `##` section end up separated by exactly one blank line and the file ends with
    exactly one `\n`.
11. **`--out`.** Resolved relative to the project root (`path.resolve(root, out)`), so an
    absolute `--out` also works. Only the plan's own files are written; nothing is deleted.

## Commands run

| Command | Result |
| --- | --- |
| `npm install` (fresh worktree had no `node_modules`) | ok |
| `npm run build -w @docsandeye/core` | ok |
| `npm run build -w docsandeye` | ok |
| `npm run build` (all workspaces; needed for `@docsandeye/themes/dist`) | ok, site **17 pages** |
| `npm run build -w docsandeye-site` | **17 page(s) built** |
| `npx vitest run` (whole suite, from the worktree root) | **24 files, 506 tests, all passed** |
| `npx vitest run --config .vs/cycle-1/scratch-tests/vitest.config.ts --dir .vs/cycle-1/scratch-tests` | 1 file, 6 tests passed |
| `node packages/cli/dist/bin.js export --project <fixture copy>` | `exported 4 buildup files, 1 okh manifest`, exit 0, output byte-identical to `packages/core/fixtures/export-expected/` |
| same command a second time | byte-identical output, exit 0 |
| `… export --project <copy> --out custom/dir` | tree relocated under `custom/dir/` |
| `… export --project <copy with an unknown component ref>` | problem printed, exit 1, no `build/` directory created |
| `… export` from a directory with no project | `no docsandeye.config.yaml found (run docsandeye init)`, exit 66 |
| `docsandeye --help` / `docsandeye export --help` | both list `export` |
| `parseConfig` probes | `{repo: "not a url"}` → `project.repo: Invalid URL`; `{title: "x", foo: 1}` → `project.foo: unrecognized key "foo"`; no `project` → `project` undefined |

Before the full workspace build, two pre-existing `starlight-docsandeye` tests failed
because `@docsandeye/themes/dist` did not exist yet in this fresh worktree; they pass
after `npm run build`. Nothing to do with this change.

## Expected-fixture review (line by line, against the spec)

- `step-01`: two parts, neither name occurs in the body → both under `## Parts` in declared
  order, adjacent bullets; `## Media` present (one entry, hero name resolved).
- `step-03`: one part (`Lid Assembly`); the body says "lid" in lower case, and matching is
  case-sensitive, so it falls to `## Parts`; `## Media` present.
- `step-05`: both entries substituted inline (`MMO anode (titanium mesh)` exercises `(`/`)`
  escaping, `Vernier callipers` the tool path), so there is no `## Parts` and no `## Tools`;
  `## Media` lists both entries in declared order, the first with two hero names.
- `index.md`: H1 is `AEP0.2 build guide` (project.title beats guide title), three step lines
  in export order, BOM sorted by id with `vial-cap-…` at `qty: 2` (summed).
- `okh.yml`: keys in the spec's order; every optional key present because the fixture's
  `project` block fills them all; `bom` sorted by id; `license`/`source`/`export` omitted per
  component where the data is absent; `manufacturing-files` is the sorted union of the two
  components' `derived_files`.

Content guard: `git commit` ran the hooks with no BLOCK or WARN finding (no bypass used).
