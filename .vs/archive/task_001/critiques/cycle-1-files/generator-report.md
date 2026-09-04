# Generator report — task_001 cycle 1

Commit: `0d34621` on `vsss/task_001-core` (worktree `/workspace/.claude/worktrees/task_001`), parent `c2277a5`.

## What was built

Repository root (npm workspaces monorepo) and `packages/core` (`@docsandeye/core`), exactly the layout in the spec:

| Path | Purpose |
| --- | --- |
| `package.json` | private root, `workspaces: ["packages/*", "site", "examples/*"]`, `test` -> `vitest run`, `build` -> `npm run build --workspaces --if-present`, `typecheck` |
| `tsconfig.base.json` | ESM, strict, NodeNext, target ES2022, declaration + source maps |
| `vitest.config.ts` | `test.projects: ['packages/*']`, `passWithNoTests: true` (root `npm test` is green before the Tester adds files) |
| `.gitignore` | appended `node_modules/` and `dist/` (root file already existed; vibe block untouched) |
| `packages/core/package.json` | `@docsandeye/core`, ESM, `exports` + `types` -> `dist/`, `build: tsc -p tsconfig.json` |
| `packages/core/tsconfig.json` | extends base, `rootDir src`, `outDir dist` |
| `packages/core/src/errors.ts` | `PROBLEM_CODES` (the eight v0.1 codes), `Problem`, `DocsiError`, `compareProblems`, `sortProblems` |
| `packages/core/src/canonical-json.ts` | `canonicalJson(value, {compact?})` |
| `packages/core/src/hosting.ts` | `HostingProvider`, `HostingRegistry`, `local` + `url-prefix`, `createHostingRegistry`, `defaultHostingRegistry`, `registerHostingProvider`, `resetHostingRegistry`, `resolveMediaUrl` |
| `packages/core/src/schemas.ts` | Zod 4 schemas; `parseComponent`, `parseStep`, `parseMedia`, `parseConfig`, `readFrontmatter`, `parsePin`, `DEFAULT_DENYLIST`, `mergeDenylist`, enum constants |
| `packages/core/src/load.ts` | `loadProject`, `isDenylisted`, `stepsForGuide`, `COLLECTION_DIRS` |
| `packages/core/src/staleness.ts` | `computeStaleness`, `changelogBetween`, `StalenessEntry` types |
| `packages/core/src/reshoot.ts` | `buildReshootIndex` |
| `packages/core/src/render-plan.ts` | `buildRenderPlan`, `renderJobKey`, `renderParamsHash`, `RENDER_OUTPUT_DIR`, `RENDER_PLAN_VERSION` |
| `packages/core/src/guard.ts` | `checkVersionBumps` |
| `packages/core/src/index.ts` | re-exports every function, constant and type above |
| `packages/core/fixtures/minimal/` | 1 component (`widget`, scad), 1 step, 1 fresh video, 1 guide (`main`, base `/`) |
| `packages/core/fixtures/aep-like/` | see below |

Dependencies pinned to exact registry-current versions: `zod 4.5.4`, `yaml 2.9.0`, `semver 7.8.5`, `picomatch 4.0.7`, `@types/semver 7.8.0`, `@types/picomatch 4.0.3`, `vitest 5.0.0`, `typescript 7.0.2` (the native TS 7 release; `tsc -p` and declaration emit work), `@types/node 22.20.1` (latest of the 22.x line, matching the runtime).

`packages/core/test/` does not exist (Tester-owned).

### aep-like fixture inventory

- Components (5): `electrode-top-stop` (scad, `2.0.0`, changelog `1.0.0`/`1.3.0`/`2.0.0` written out of order to exercise sorting), `vial-cap-2x6.1-5x3.2` (scad, `2.1.0`, `parameters`, `supersedes`, 2-entry changelog), `anode-mmo` (`off-the-shelf`, `none`, `source_files: []`, supplier), `lid-assembly` (`assembly`, **`f3z`**, 2 `derived_files`), `vernier-callipers` (`off-the-shelf`, `none`, `source_files` omitted -> defaults to `[]`). Plus the stray `docs/components/README.md`.
- Config: `theme: pioreactor`, guides `aep` (`/AEP`) and `mep` (`/MEP`), user denylist `["private-notes/**", "drafts/**"]` (first entry duplicates a default -> dedup), `hosting: url-prefix` with `base`, `byte_budget_kb: 200`.
- Steps (3): `step-01-print-parts` (`guide: [aep, mep]`, `branch: [scratch]`, 2 renders, viewer), `step-03-lid` (`guide: aep`, `branch: [kit]`, two render ids on the f3z component -> two hand-exported jobs with identical outputs, viewer), `step-05-electrolysis` (no `guide`, `branch: [scratch, kit]`, the spec's `topstop-exploded` render example, viewer, `safety`).
- Media (3): `vid-005-electrode-seating` -> **STALE** (hero `electrode-top-stop@1.3.0` vs `2.0.0`; in_frame `vial-cap@2.0.0` vs `2.1.0` also recorded under `changed_in_frame`), `vid-003-cap-fitting` -> **CHANGED_IN_FRAME** (hero fresh, in_frame `electrode-top-stop@1.3.0`), `photo-003-lid-closed` -> **FRESH**.
- `private-notes/pi02-setup-notes.md` and `private-notes/deeper/more.md`, each containing `DENYLISTED-SENTINEL`.

## How each acceptance criterion is met

1. **Component schema** — `ComponentSchema` (Zod 4): `design_version` and `changelog[].version` are `RELEASE_SEMVER_RE`; `supersedes` is `PIN_RE`; `kind`/`master_format` enums; `superRefine` adds `source_files` (empty for `none`, non-empty otherwise), `derived_files` (non-empty for `f3z`) and duplicate-changelog-version issues at `changelog.<i>.version`; transform sorts changelog ascending. `id !== stem(filename)` -> `id-mismatch` at path `id`. Zod issues map to `{code: 'schema', file, path: issue.path.join('.'), message}`, sorted by path.
2. **Step schema** — `readFrontmatter` + `StepFrontmatterSchema`; `guide` string|array normalised to `string[] | undefined`; defaults `qty: 1`, `cat: part`/`tool`, `view: iso`, `explode/annotate: false`, `format: png`, viewer `format: glb`; duplicate render ids -> `renders.<i>.id`; missing `component`/`id`, bad `view`/`format`/`cat`, missing `order` all rejected with the dotted path; `body` is the Markdown after the closing fence.
3. **Media schema** — `MediaSchema`: video requires `poster` + `duration_s` (> 0); photo forbids `poster`, `captions`, `duration_s`; `hero` min 1 pins; `in_frame` defaults to `[]`; unknown `type`; id/stem mismatch.
4. **Config schema** — `parseConfig(text, {registry?})` builds the schema against the given registry (default: `defaultHostingRegistry`) so provider validation is dynamic; `url-prefix` without `base` -> `hosting.base`; duplicate guide ids -> `guides.<i>.id`; `base` must start with `/`; `guides: []` rejected; defaults `theme: starlight`, `hosting: {provider: local}`, `byte_budget_kb: 150`, denylist = `DEFAULT_DENYLIST` then user entries, de-duplicated. `resetHostingRegistry()` clears the default registry in place and re-adds the two built-ins.
5. **Project loader** — `loadProject(root)`: reads the config, then `docs/components` + `docs/media` (`.yaml`/`.yml`, case-insensitive) and `docs/steps` (`.md`), sorted directory order; every collection file path is checked with `isDenylisted(relPath, config.denylist)` before `readFileSync`; missing directories -> empty maps, no problem; `guide` default `[config.guides[0].id]`. `isDenylisted` = `picomatch(patterns, {dot: true})` on the POSIX path.
6. **Cross-reference check** — problems aggregated (never thrown) for `unknown-component` (parts/tools/renders/viewer and media pins), `unknown-media`, `unknown-guide` (`guide.<i>`), `future-pin` (`semver.compare(pin, current) === 1`), `duplicate-id` (second file by sorted name keeps path `id`; first wins), plus per-file `schema`/`invalid-yaml` (file omitted from the map). Sorted by `file` then `path` with code-point comparison.
7. **Staleness** — `computeStaleness`: STALE iff any hero pin `compare !== 0`; CHANGED_IN_FRAME iff no hero differs but an in_frame pin does; `changelog` = entries with `shot_with < v <= current`, ascending, copied. Iterates media ids sorted; copies every entry (no shared refs); never mutates the model.
8. **Reshoot index** — `buildReshootIndex`: one entry per component that appears in at least one pin; `staleHeroCount` = hero appearances listed in `stale_heroes`; `appearances[].status` is the media's overall status; sorted `staleHeroCount` desc then `component` asc; appearances by `media` (then role).
9. **Render plan** — `buildRenderPlan`: `options` = `{annotate, explode, format, view}` (alphabetical, `undefined` dropped) for renders, `{format}` for viewers; `parameters` = `structuredClone(component.parameters ?? {})`; key = `<component>@<design_version>--<render_id>--<sha256(canonicalJson({parameters, options}, {compact: true})).slice(0, 12)>`; de-dup by key; `f3z|none` -> `status: 'hand-exported'`, `outputs = derived_files`; otherwise `build/render/<key>.<format>`; sorted by component, render_id, key; `{version: 1, project_root: '.', jobs}`.
10. **Version-bump guard** — `checkVersionBumps(model, facts)` -> `{violations, unchecked}`; empty `source_files` skipped silently; missing facts -> `unchecked` (sorted); `sourceCommit !== versionCommit` -> `Violation {component, designVersion, sourceCommit, versionCommit, message}`. No git.
11. **Hosting seam** — `local` returns `file`; `url-prefix` = `base.replace(/\/+$/, '') + '/' + file.replace(/^\/+/, '')`; `registerHostingProvider(name, impl, registry = defaultHostingRegistry)`; `createHostingRegistry()`; `resolveMediaUrl(hosting, file, registry = default)` dispatches through the registry and throws on an unknown provider.
12. **Public surface** — `index.ts` re-exports everything named in the ACs plus `canonicalJson`, `PROBLEM_CODES`, `defaultHostingRegistry`, the enum constants and all types. Scratch test `surface.test.ts` imports both `@docsandeye/core` (built `dist/`) and `src/index.ts` and asserts each named export is a function/object.
13. **Frontmatter helper** — `readFrontmatter(text)`: line 1 must be `---` (optional `\r`); closing `---`/`---\r` on its own line; body starts after the closing fence's newline (`''` when the fence is the last line); no opening fence -> `{data: {}, body: text}`; unterminated -> `DocsiError` `invalid-yaml`. Frontmatter YAML is normalised to LF before parsing so CRLF files do not yield `"1\r"` scalars; the body keeps its CRLF.
14. **Guide filtering** — `stepsForGuide(model, guideId)` filters on resolved `guide`, sorts by `order` then `id`; unknown guide -> `[]`.
15. **Canonical JSON** — `canonicalJson`: recursive key sort, arrays preserved, `undefined` members dropped (array holes become `null` as `JSON.stringify` does), `Map` and `toJSON` handled, 2-space indent unless `compact`.

## Commands and final output lines

All run from the worktree root with `export PATH=$HOME/.local/node22/bin:$PATH` (Node 22.23.2, npm 10.9.8).

```
$ npm install
added 47 packages, and audited 49 packages in 10s
found 0 vulnerabilities

$ npx tsc --noEmit -p packages/core
(no output)   # exit 0

$ npm run build -w @docsandeye/core
> @docsandeye/core@0.1.0 build
> tsc -p tsconfig.json
$ ls packages/core/dist/index.js packages/core/dist/index.d.ts
packages/core/dist/index.d.ts
packages/core/dist/index.js

$ npx vitest run --config .vs/cycle-1/scratch-tests/vitest.config.ts
 Test Files  4 passed (4)
      Tests  45 passed (45)

$ npm test          # root, projects packages/*, no Tester files yet
exit 0              # passWithNoTests
```

Scratch tests live in `.vs/cycle-1/scratch-tests/` (gitignored): `schemas.test.ts` (AC1-4, 13), `load.test.ts` (AC5, 6, 14), `engine.test.ts` (AC7-11, 15), `surface.test.ts` (AC12). They were run red (module missing) before the source was written, then green. `surface.test.ts` needs `npm run build -w @docsandeye/core` first because it imports the built package entry.

## Choices made on ambiguous points

- **`shot_date` and `shot_by` are required** on media manifests (the spec marks optional fields explicitly and leaves these unmarked; `shot_date` is also emitted into `staleness.json`). `shot_date` and `changelog[].date` must match `YYYY-MM-DD`.
- **Unknown keys are stripped, not rejected** (Zod default). The spec never lists extra keys as a rejection trigger and BuildUp/OKH compatibility suggests tolerating them. `hosting` is a loose object so provider-specific keys (`bucket`, ...) survive to `resolve(file, config)`.
- **`source_files` and `derived_files` default to `[]`** when absent, so `Component.source_files: string[]` is always present (the guard and render plan rely on it).
- **`branch`** accepts a string or string array and is passed through unchanged, as the spec says (no normalisation).
- **`Problem.code` is typed `ProblemCode`** (the union of the eight strings) rather than bare `string`; it is assignable to `string`.
- **Missing or unparsable `docsandeye.config.yaml` throws `DocsiError`** (code `schema` for "not found", the parse problems otherwise) — the loader cannot resolve guide defaults or the denylist without it; every other failure is aggregated into `problems`.
- **Duplicate ids across files**: the first file in sorted directory order wins; the later file gets `duplicate-id` at path `id` and is omitted.
- **Pins naming unknown components** are skipped by `computeStaleness`, `buildReshootIndex` and `buildRenderPlan` (they are already reported by `loadProject`).
- **`parseComponent` sorts the changelog with a private numeric comparator** on the strict `MAJOR.MINOR.PATCH` grammar; `semver.compare` is used everywhere versions from two sources meet (future-pin, staleness).
- **`parseConfig` filename**: problems from `parseConfig` carry `file: 'docsandeye.config.yaml'` (override via `options.filename`).
- **Root `vitest.config.ts`** uses `projects: ['packages/*']` (per the Generator instructions; the spec text says `packages/*/test`). Vitest 5 treats each matching directory with a `package.json` as a project, so Tester files under `packages/core/test/` will be picked up by the default include glob. `passWithNoTests: true` keeps root `npm test` green until then.

## Things to flag to the chair

- **`Martin/Docs&I.md` was found staged in the worktree index** (120 KB, `A` in `git status`) while I worked, although I never ran `git add` on it and it is excluded by the root `.gitignore` (`/Martin/`, "Confidential"). I ran `git restore --staged "Martin/Docs&I.md"` so it did not go into my commit; the file is untouched on disk. The worktree branch was also rebased under me (`e3dc5b1` -> `c2277a5`) between my first read and the commit; my commit sits on the new `c2277a5`.
- `typescript 7.0.2` is the Go-native TypeScript release. It builds and type-checks this package cleanly; if downstream tooling needs the JS-based compiler, pin `typescript` to the latest 5.x/6.x line instead.
- Nothing unmet. All 15 acceptance criteria are covered by scratch tests.
