# task_001 — `@docsandeye/core`: content schemas, staleness engine, render plan, guards

## Task summary

Build the TypeScript library every other Docs&I package compiles against: Zod schemas for the three content collections (components, steps, media manifests for videos and photos) plus the project config; the loader that reads a project tree into a validated, cross-referenced model; the build-time staleness engine that pins `component@version` in each media manifest against the component's current `design_version` and emits `staleness.json`; the inverse "reshoot" index; the render plan that the Python pipeline (task_002) consumes as JSON; the pure version-bump guard; and the hosting-provider seam. Pure functions over plain data, no git or filesystem side effects beyond reading the project tree. This is the contract for the Starlight plugin (task_003), the CLI (task_004) and the AEP0.2 content (task_006), so names and shapes are chosen here once.

Decisions already made by Martin (do not reopen): identifier `docsandeye` everywhere, npm scope `@docsandeye`; explicit human-bumped semver `design_version`, never file hashes; photos are first-class media with the same hero/in-frame tagging as videos; field names stay BuildUp/OKH-compatible but no exporters; the Plus hosting tier plugs in through a provider seam, no paid code; Whisper is out of scope for v0.x.

## Repository layout (this task creates the root)

```
package.json                 private, "workspaces": ["packages/*", "site", "examples/*"], scripts: test → vitest run, build → npm run build --workspaces --if-present
tsconfig.base.json           ESM, strict, NodeNext, target ES2022
vitest.config.ts             projects: packages/*/test
packages/core/package.json   name @docsandeye/core, type module, exports ./dist/index.js, types; deps: zod, yaml, semver, picomatch (+ @types)
packages/core/src/           schemas.ts, load.ts, staleness.ts, reshoot.ts, render-plan.ts, guard.ts, hosting.ts, errors.ts, canonical-json.ts, index.ts
packages/core/test/          Tester-owned (immutable once committed)
packages/core/fixtures/      Generator-owned example projects used by BOTH Generator scratch tests and Tester tests: `minimal/` (1 component, 1 step, 1 video, all fresh, 1 guide) and `aep-like/` (see below)
```

`aep-like` fixture requirements: ≥ 4 components including one with `master_format: f3z`, one `off-the-shelf` with empty `source_files`, and one whose `changelog` spans ≥ 3 versions; config with 2 guides (`aep` base `/AEP`, `mep` base `/MEP`); ≥ 3 steps, at least one listing `guide: [aep, mep]`, one in `aep` only, and one omitting `guide`; both a `scratch`/`kit` branch use; ≥ 2 videos and ≥ 1 photo, such that exactly one media manifest is STALE, exactly one is CHANGED_IN_FRAME and the rest are FRESH; the files `private-notes/pi02-setup-notes.md` and `private-notes/deeper/more.md`, each containing the literal string `DENYLISTED-SENTINEL`; and a stray `docs/components/README.md` (non-YAML, must be ignored by the loader).

The fixture directory layout mirrors a real project: `docs/components/*.yaml`, `docs/steps/*.md`, `docs/media/*.yaml`, `docsandeye.config.yaml`. The Tester may add further fixtures under `packages/core/test/fixtures/` but must not edit Generator fixtures.

## Versions (normative)

`design_version`, every `changelog[].version`, the version in `supersedes`, and every media pin version are **release semver** only: `MAJOR.MINOR.PATCH` with non-negative integers and no leading zeros; pre-release suffixes (`-rc.1`) and build metadata (`+abc`) are rejected at parse time. Comparison uses the `semver` package's `compare` (so `1.10.0 > 1.9.0`). "Differs" means `compare !== 0`; "greater" means `compare === 1`.

## Data model (normative)

Component (`docs/components/<id>.yaml`):

```yaml
id: vial-cap-2x6.1-5x3.2          # kebab-case ([a-z0-9]+(-[a-z0-9.]+)*), unique, equals filename stem
name: Vial Cap (2×6.1 mm + 5×3.2 mm ports)
kind: printed                     # printed | off-the-shelf | kitted | assembly
design_version: 2.1.0             # release semver, bumped by hand
master_format: scad               # scad | step | f3z | none
source_files: ["Components/Vial Cap/Vial Cap.scad"]      # repo-relative; required non-empty for scad|step|f3z, must be empty for none
parameters: {ports: 5, port_dia: 3.2}                     # optional; values: string | number | boolean | flat array of those
derived_files: ["Components/Vial Cap/2x6.1 + 5x3.2mm ports/Vial Cap 2x6.1 + 5x3.2 v2.stl"]  # optional; required non-empty for f3z
depends_on: [bosl2]               # optional, free-form ids
supersedes: vial-cap-2x6.1-5x3.2@1.4.0                    # optional `<id>@<release semver>`
licence: CC-BY-SA-4.0             # optional string
supplier: {name: LabCrafter, url: https://…, mpn: ABC-123}  # optional
changelog:                        # optional; versions unique release semver; sorted ascending by version at load
  - {version: 2.1.0, date: 2026-08-11, note: "Dovetail added for cap o-ring."}
```

Step (`docs/steps/<id>.md`, YAML frontmatter + Markdown body):

```yaml
id: step-05-electrolysis          # kebab-case, equals filename stem
order: 5                          # integer ≥ 0
title: Electrolysis setup
guide: aep                        # optional; string or array; normalised to string[] by parseStep; absent → resolved by loadProject to [config.guides[0].id]
branch: [scratch, kit]            # optional; absent = all branches
parts: [{component: anode-mmo, qty: 1, cat: part}]        # cat: part | printed | tool | consumable | prev; qty integer ≥ 1, default 1
tools: [{component: vernier-callipers, qty: 1}]           # cat defaults to tool
renders: [{id: topstop-exploded, component: electrode-top-stop, view: front-top-right, explode: true, annotate: true, format: png}]
                                  # id and component required; view default iso; explode/annotate default false; format default png
                                  # view ∈ front|back|left|right|top|bottom|iso|front-top-right|front-top-left; format ∈ png|stl|svg|glb
viewer: {component: electrode-top-stop, format: glb}      # optional; format default glb
media: [vid-005-electrode-seating, photo-005-wiring]      # optional, media manifest ids in display order
safety: "Do not energise LED channel D with the cap off." # optional
```

Media manifest (`docs/media/<id>.yaml`), one per video or photo:

```yaml
id: vid-005-electrode-seating     # kebab-case, equals filename stem
type: video                       # video | photo
file: assets/video/vid-005-electrode-seating.mp4           # video: primary file; photo: the image
poster: assets/video/vid-005-electrode-seating.jpg         # video only, required; forbidden for photo
captions: assets/video/vid-005-electrode-seating.en.vtt    # video only, optional; forbidden for photo
duration_s: 47                    # video only, required, number > 0; forbidden for photo
shot_date: 2026-07-19             # ISO date string
shot_by: "Martin Currie"
hero: [electrode-top-stop@1.3.0, anode-mmo@1.0.0]          # ≥ 1 entry, `<id>@<release semver>`
in_frame: [vial-cap-2x6.1-5x3.2@2.0.0]                     # optional
narration_source: steps/step-05-electrolysis.md            # optional
licence: CC-BY-SA-4.0             # optional
```

Config (`docsandeye.config.yaml` at project root):

```yaml
theme: pioreactor                 # optional, default "starlight"
guides: [{id: aep, title: "Aseptic ElectroPioreactor", base: /AEP}]   # ≥ 1; ids unique kebab-case; base starts with "/"
denylist: ["private-notes/**"]    # optional; the DEFAULT_DENYLIST below is always merged in (union, de-duplicated, order: defaults then user entries)
hosting: {provider: local}        # provider name looked up in the hosting registry at parse time; url-prefix requires base
byte_budget_kb: 150               # default 150, integer > 0
```

`DEFAULT_DENYLIST = ["private-notes/**", ".claude/**", ".vibe/**", ".git/**", "node_modules/**"]` (exported constant). Glob semantics are `picomatch` with `{ dot: true }` applied to the POSIX-style repo-relative path: `**` matches zero or more path segments, so `private-notes/**` matches `private-notes/a.md` and `private-notes/a/b.md` and not `private-notesx/a.md`; exported `isDenylisted(relPath, patterns)`.

`staleness.json` (emitted by `computeStaleness`; serialised with `canonicalJson`, which sorts object keys recursively at every depth and emits 2-space indentation):

```json
{"vid-005-electrode-seating": {"type": "video", "status": "STALE", "shot_date": "2026-07-19",
  "stale_heroes": [{"component": "electrode-top-stop", "shot_with": "1.3.0", "current": "2.0.0",
     "changelog": [{"version": "2.0.0", "date": "2026-09-01", "note": "M3 nut trap moved"}]}],
  "changed_in_frame": []}}
```

Render plan (`build/render-plan.json`, consumed by task_002; this task defines and emits it):

```json
{"version": 1, "project_root": ".", "jobs": [
  {"key": "electrode-top-stop@2.0.0--topstop-exploded--3f9a1c2b7e4d", "component": "electrode-top-stop",
   "design_version": "2.0.0", "render_id": "topstop-exploded", "master_format": "scad",
   "source_files": ["Components/ElectrodeTopStop/ElectrodeTopStop.scad"], "parameters": {},
   "options": {"view": "front-top-right", "explode": true, "annotate": true, "format": "png"},
   "outputs": ["build/render/electrode-top-stop@2.0.0--topstop-exploded--3f9a1c2b7e4d.png"]}]}
```

Job rules: `parameters` is a verbatim copy of the component's top-level `parameters` (`{}` when absent) — step renders never carry parameters. `options` is the render entry with defaults applied and only the keys `annotate`, `explode`, `format`, `view` (alphabetical, as `canonicalJson` emits them; the render entry's `id` and `component` are not part of `options`). `key` = `<component>@<design_version>--<render_id>--<params-hash>` where `params-hash` is the first 12 lowercase hex chars of SHA-256 over `canonicalJson({parameters, options})` serialised compactly (sorted keys at every depth, no whitespace — `canonicalJson(value, {compact: true})`). Viewer entries become jobs with `render_id: "viewer"`, `options: {format: <viewer format>}`. Jobs are de-duplicated by `key` across all steps and guides; the job order is by `component`, then `render_id`, then `key`. Components whose `master_format` is `f3z` or `none` produce jobs with the same key formula, `"status": "hand-exported"` and `outputs` equal to their `derived_files` (no rendering); two different render ids on such a component therefore yield two hand-exported jobs with identical outputs. Every non-hand-exported output path is `build/render/<key>.<format>`.

Problem shape, used everywhere: `Problem = {code: string, file: string, path: string, message: string}` (`path` is the YAML/JSON pointer-style dotted path, `""` for file-level). `DocsiError extends Error` with `problems: Problem[]`. Codes are stable strings listed in `errors.ts` (exactly these in v0.1: `invalid-yaml`, `schema`, `id-mismatch`, `unknown-component`, `unknown-media`, `unknown-guide`, `future-pin`, `duplicate-id`). Denylisted files produce no problem at all; they are simply never read.

`branch` is stored and passed through unchanged in this task; no branch filtering function is in scope (the plugin, task_003, decides how branches render).

## Acceptance criteria

1. **Component schema.** `parseComponent(text, filename)` returns a typed `Component` for the fixture files (changelog sorted ascending by version) and throws `DocsiError` for: a non-release-semver `design_version` (including `2.0.0-rc.1` and `2.0.0+build`), an `id` that does not match the filename stem, an unknown `kind` or `master_format`, a `supersedes` value not of the form `<id>@<release semver>`, `master_format: scad|step|f3z` with empty `source_files`, `master_format: f3z` with empty `derived_files`, a `changelog` entry with a non-release-semver `version`, and duplicate `changelog` versions. Each problem carries `code`, `file` (= `filename`), `path` (e.g. `design_version`, `changelog.1.version`), `message`.
2. **Step schema.** `parseStep(text, filename)` parses frontmatter plus body, returns `Step` with `body` (Markdown string) and typed fields, normalises `guide` to `string[] | undefined`, applies defaults (`qty: 1`, `cat: tool` for tools, `view: iso`, `explode: false`, `annotate: false`, `format: png`, viewer `format: glb`), and throws `DocsiError` for a missing `order`, a duplicate render `id` within the step, a render without `component` or `id`, an unknown `view` or `format`, an unknown `cat`, and an `id` not matching the filename stem.
3. **Media schema.** `parseMedia(text, filename)` accepts both fixture videos and photos; throws `DocsiError` for a video without `poster` or `duration_s`, a photo with `poster`, `captions` or `duration_s`, an empty `hero`, any pin that is not `<id>@<release semver>`, an unknown `type`, and an `id` not matching the filename stem.
4. **Config schema.** `parseConfig(text, {registry?})` applies defaults (`theme: starlight`, `DEFAULT_DENYLIST` merged first then user entries, de-duplicated, `hosting.provider: local`, `byte_budget_kb: 150`) and throws for `guides: []`, duplicate guide ids, a `base` not starting with `/`, a hosting provider name not present in the registry (default registry = the built-ins `local`, `url-prefix`), and `url-prefix` without `base`. Test: `parseConfig` on `provider: s3` throws; after `registerHostingProvider('s3', impl)` on the default registry it succeeds; a fresh explicit `registry` (from `createHostingRegistry()`) passed in does not see that registration. `resetHostingRegistry()` restores the default registry to the two built-ins so tests can isolate themselves.
5. **Project loader.** `loadProject(root)` reads `docsandeye.config.yaml` and the three collections (only `*.yaml` / `*.yml` for components and media, only `*.md` for steps; other files ignored), resolves each step's `guide` default to `[config.guides[0].id]`, returns `{config, components, steps, media, problems}` with `components`/`steps`/`media` as `Map<id, …>`, never opens any file whose repo-relative path is denylisted (the `DENYLISTED-SENTINEL` string appears nowhere in the returned model, its problems, or any thrown error, for both fixture files), and reports a missing collection directory as an empty map, not a problem. `isDenylisted` is tested directly on this table: `private-notes/a.md` → true, `private-notes/a/b.md` → true, `private-notesx/a.md` → false, `.claude/settings.local.json` → true, `docs/steps/x.md` → false.
6. **Cross-reference check.** `loadProject` aggregates (does not throw on the first) problems for: a step part/tool/render/viewer naming an unknown component (`unknown-component`); a step `media` id with no manifest (`unknown-media`); a media pin naming an unknown component; a media pin whose version is greater than the component's current `design_version` (`future-pin`); duplicate component/step/media ids across files (`duplicate-id`); a step `guide` entry not declared in config (`unknown-guide`). Per-file parse failures become problems too (`schema` / `invalid-yaml`) and the offending file is omitted from the maps. Problems are sorted by `file` then `path`.
7. **Staleness.** `computeStaleness(model)` returns `Record<mediaId, StalenessEntry>` with `status` ∈ `FRESH | CHANGED_IN_FRAME | STALE`: STALE iff any hero pin's version differs from the current `design_version`; CHANGED_IN_FRAME iff no hero differs but an in_frame pin does; FRESH otherwise. Each stale/changed record carries `component`, `shot_with`, `current`, and `changelog` = the component's entries with `shot_with < version <= current`, ascending. The `aep-like` fixture yields exactly one STALE, one CHANGED_IN_FRAME and the rest FRESH; `canonicalJson(result)` parsed back has top-level keys in lexicographic order and every nested object's keys in lexicographic order (the test walks the parsed tree); `computeStaleness` never mutates its input (deep-equal before/after).
8. **Reshoot index.** `buildReshootIndex(model, staleness)` returns `Array<{component, name, current, staleHeroCount, appearances: Array<{media, type, role: 'hero' | 'in_frame', shot_with, status}>}>` sorted by `staleHeroCount` descending, then `component` ascending; components with no appearances are omitted; appearances sorted by `media`.
9. **Render plan.** `buildRenderPlan(model)` emits the schema above: keys computed exactly as specified (the test recomputes one hash independently with `node:crypto` from a hand-built canonical string), one job per distinct key, `hand-exported` jobs for `f3z|none` masters with outputs = `derived_files`, parameters copied from the component, job order as specified, output paths under `build/render/`.
10. **Version-bump guard.** `checkVersionBumps(model, facts)` where `facts: Record<componentId, {sourceCommit: string, versionCommit: string}>` returns an object `{violations: Violation[], unchecked: string[]}`; `Violation = {component, designVersion, sourceCommit, versionCommit, message}`, one per component whose `sourceCommit !== versionCommit`, none when equal; components with empty `source_files` are skipped silently; components with non-empty `source_files` but absent from `facts` are skipped and listed in `unchecked` (sorted). Pure: no git calls.
11. **Hosting seam.** `resolveMediaUrl(hosting, file)` returns `file` unchanged for `local`; for `url-prefix` returns `base` with trailing slashes removed + `/` + `file` with leading slashes removed (so `https://m.example` and `https://m.example/` both give `https://m.example/assets/x.mp4`). `HostingProvider = {name, resolve(file, config): string}`; `registerHostingProvider(name, impl, registry = defaultRegistry)` and `createHostingRegistry()` are exported; `resolveMediaUrl` dispatches through the registry.
12. **Public surface.** `packages/core/src/index.ts` re-exports every function, constant and type named in these criteria plus `canonicalJson`; a test imports the package entry and asserts the named exports exist and are functions/objects. (Chair-run shell checks, not Tester tests: `npm install`, `npm run build -w @docsandeye/core` emitting `dist/index.js` and `dist/index.d.ts`, and `npm test` green from the repo root.)
13. **Frontmatter helper.** `readFrontmatter(text)` handles `---`-fenced YAML at the top of a Markdown file (LF or CRLF), returns `{data, body}` with `body` starting after the closing fence's newline, returns `{data: {}, body: text}` when there is no opening fence on line 1, and throws `DocsiError` (`invalid-yaml`) for an unterminated fence.
14. **Guide filtering.** `stepsForGuide(model, guideId)` returns the steps whose resolved `guide` includes `guideId`, ordered by `order` then `id`; on the `aep-like` fixture the shared step appears for both guides, the aep-only step for `aep` only, and the step that omitted `guide` for `aep` (the first configured guide) only; an unknown `guideId` returns `[]`.
15. **Canonical JSON.** `canonicalJson(value, {compact?})` sorts object keys recursively, preserves array order, emits 2-space indentation unless `compact`, and round-trips through `JSON.parse` to a deep-equal value.

## Out of scope

- No Starlight, Astro or browser code (task_003). No CLI entry points or git calls (task_004). No Python (task_002).
- No BuildUp or OKH exporters; no PDF; no i18n.
- No video encoding, posters, captions generation, or the stale-video UX (v0.2).
- No geometry hashing or mesh diffing (v0.3).
- No network access at runtime; no reading outside `root`.
- No paid-tier code; the hosting seam is the registry plus the two free providers only.
- Do not edit `README.md`, `TODO.md`, `CHANGELOG.md`, `.vs/tasks.json` or `.vs/progress.md` (chair-owned).

## Test location

`packages/core/test/` (vitest). Generator scratch tests go under `.vs/cycle-<N>/scratch-tests/` only. Tests may import fixtures from `packages/core/fixtures/` and add their own under `packages/core/test/fixtures/`.

## Proposed budget

3 cycles. Rationale: schema-heavy but fully specified; the risk is cross-reference and staleness edge cases, which a second cycle normally closes.

## Model plan

- Generator: **fable** (pre-authorised), ceiling fable. Rationale: this package is the long-horizon contract for four downstream tasks; getting the shapes coherent in one pass is worth the tier.
- Spec Critic: sonnet. Tester: haiku, ceiling sonnet on test-quality findings.
- Fable rung: **pre-authorised (--fable-subagents)**.
