# task_004 — `docsandeye` CLI: init, render, check

## Task summary

Build the Node command-line tool that hardware authors run: `docsandeye init` scaffolds a Starlight site wired to the `starlight-docsandeye` plugin; `docsandeye render` loads the project with `@docsandeye/core`, writes `build/render-plan.json` and invokes the Python pipeline (`python3 -m docsandeye_render`); `docsandeye check` runs the content validation, the version-bump guard against real git history, and the per-page byte budget plus CO2.js estimate over a built site. The CLI is thin wiring over the two settled contracts (task_001's model and render plan, task_002's manifest and exit codes); it owns git access and process spawning so the libraries stay pure.

Sequencing (chair commitment): the Generator for this task is dispatched only after task_001 (`@docsandeye/core`, root workspaces) and task_002 (`render/`) have merged to `main` and this worktree has been rebased onto it, so `npm install`, `@docsandeye/core` imports and the `render/` sibling all exist. The Generator must not create stand-ins for either.

Decisions already made: renders run locally and are committed, never in GitHub Actions; the byte budget is 150 KB for a step page's poster-only initial load and is a warning in v0.1 (hard fail arrives in v0.2); the carbon figure uses CO2.js's Sustainable Web Design model v4; Whisper and video encoding are out of scope for v0.1.

## Package layout (owns `packages/cli/**` only)

```
packages/cli/package.json      name docsandeye, bin {"docsandeye": "./dist/bin.js"}, deps: @docsandeye/core (workspace), @tgwf/co2, yaml, node-html-parser; devDeps vitest
packages/cli/src/bin.ts        argv parsing (node:util parseArgs), dispatch, exit codes
packages/cli/src/init.ts       scaffold
packages/cli/src/render.ts     plan → python
packages/cli/src/check.ts      validate + guard + budget + carbon
packages/cli/src/git.ts        git facts via child_process.execFile, never shell strings
packages/cli/src/budget.ts     dist walker + CO2.js
packages/cli/src/paths.ts      project-root discovery; render-dir resolution
packages/cli/templates/        files copied by init (astro.config.mjs, package.json, docsandeye.config.yaml, docs/components/example-part.yaml, docs/steps/step-01-example.md, docs/media/.gitkeep, src/content.config.ts, README.md)
packages/cli/test/             Tester-owned
packages/cli/fixtures/         Generator-owned: `project/` (a small valid Docs&I project, may be a copy of core's aep-like shape), `fake-bin/python3` (a POSIX `sh` script that appends exactly one JSON line `{"argv": [<all arguments after the program name>], "cwd": "<cwd>", "env": {"PYTHONPATH": <string or null>}}` to `$DOCSI_FAKE_PYTHON_LOG`, prints nothing, and exits with `$DOCSI_FAKE_PYTHON_EXIT` if set, else 0; committed mode 100755 and `chmod 0o755` in test `setUp`), `dist/` (a hand-written built-site tree for budget tests: two step pages with the meta tag, root-absolute and page-relative asset hrefs, a `srcset`, a `<video poster>`, a `<video><source>`, an external URL, and one missing local asset)
```

## Contracts consumed (normative pointers)

- Render plan and `loadProject`/`checkVersionBumps`/`canonicalJson`: task_001 spec. `checkVersionBumps` returns `{violations, unchecked}`.
- Python invocation and exit codes: task_002 spec (`render` exit 0/1/2; `doctor`).
- Step-page markup: task_003 emits `<meta name="docsandeye:step" content="<step id>">` in every step page's `<head>`; asset references are root-absolute (`/_astro/…`, `/_docsandeye/…`) as Astro emits them, but page-relative hrefs are handled too (below).
- `carbon.json` (this task writes it; task_003 reads it): `{"version": 1, "pages": {"/AEP/step-02-cap/": {"bytes": 123456, "gco2e": 0.0118}}}`; keys are site-relative URL paths with leading and trailing slash derived from the dist path (`<dir>/AEP/step-02-cap/index.html` → `/AEP/step-02-cap/`; `<dir>/index.html` → `/`); serialised with core's `canonicalJson`.

## Acceptance criteria

1. **Argument parsing and help.** `docsandeye --help` and each subcommand's `--help` print usage to stdout and exit 0; an unknown subcommand or unknown flag prints usage to stderr and exits 64; `--version` prints the package version and exits 0. Tests invoke the built `bin.js` via `execFile('node', [bin, …])`.
2. **init scaffolds a working project.** `docsandeye init <dir> --guide aep --title "Aseptic ElectroPioreactor"` creates the template tree in an empty or non-existent `<dir>`; if `<dir>` already contains `docsandeye.config.yaml` or `astro.config.mjs` it exits 65 with `init: <file> already exists (use --force to overwrite template files)` unless `--force`, which overwrites only the files the template would write and leaves every other existing file untouched; the generated `astro.config.mjs` contains `import starlight from '@astrojs/starlight'`, `import docsandeye from 'starlight-docsandeye'` and `plugins: [docsandeye()]`; the generated `docsandeye.config.yaml` parses with core's `parseConfig` and contains the given guide id and title; the generated example content loads with `loadProject` yielding zero problems. Package presence of `starlight-docsandeye` is not required for this test (the files are text).
3. **render writes the plan and calls Python.** `docsandeye render [--project <root>] [--force] [--allow-missing]` writes `<root>/build/render-plan.json` whose content is `canonicalJson(buildRenderPlan(model))` followed by exactly one `\n` appended by the CLI (core's `canonicalJson` emits no trailing newline), then spawns `python3` with argv `['-m', 'docsandeye_render', 'render', '--plan', 'build/render-plan.json', '--out', 'build/render', '--project-root', '.']` plus `'--force'` and/or `'--allow-missing'` when given (in that order), `cwd = <root>`, and `env.PYTHONPATH` = `<renderDir>` + (`path.delimiter` + inherited `PYTHONPATH` if set), where `<renderDir>` = `process.env.DOCSANDEYE_RENDER_PYTHONPATH` if set, else `path.resolve(<cli package dir>, '../../render')` (the repo's `render/` directory relative to `packages/cli/`); the CLI's exit code equals the child's; with the fake `python3` the test asserts argv, cwd and `PYTHONPATH`; when `python3` is not on `PATH` the CLI exits 2 with `python3 not found: install Python 3.11+`.
4. **render refuses an invalid project.** If `loadProject` returns any problem, `render` prints them (one per line: `<file>:<path>: <code>: <message>`) to stderr and exits 1 without writing the plan or spawning Python.
5. **check: validation.** `docsandeye check [--project <root>]` prints every `loadProject` problem in the same one-line form and counts each as an error.
6. **check: version-bump guard from real git.** Facts per component: `sourceCommit` = `git log -1 --format=%H -- <each source file…>` (all source files in one invocation); `versionCommit` = `git log -1 --format=%H -G'^design_version:' -- <component yaml>` (regex line-diff mode; the test also asserts, in a repo where the version was edited after the file was created, that the recipe returns the edit commit, not the creation commit). In a temporary git repository built by the test (component created with version 1.0.0, then source edited and version bumped in one commit, then source edited alone), `check` reports `guard: <component>: source changed in <sha7> but design_version is still <version>` (error; `<sha7>` = the first 7 characters of the full `%H` hash, never git's own abbreviation) for that last state and nothing after a subsequent version bump; the same temporary repository also contains a second component whose source file exists on disk but has never been committed, which is reported as `guard: <component>: no git history for its source files` (warning). When `git rev-parse --is-inside-work-tree` fails, `check` prints `guard: not a git repository, version-bump guard skipped` (warning) and continues.
7. **check: byte budget.** With `--dist <dir>`, `check` finds every `index.html` under `<dir>` whose `<head>` has `<meta name="docsandeye:step">` and computes initial-load bytes = on-disk size of the HTML + sizes of the local targets of: `<link rel="stylesheet" href>`, `<link rel="modulepreload" href>`, `<link rel="preload" href>`, `<script src>`, `<img src>`, and `<video poster>`; for `<img srcset>` / `<source srcset>` the largest candidate by file size is counted (one candidate is what a browser fetches). URL resolution: a root-absolute href (`/x`) resolves to `<dir>/x`; a page-relative href resolves against the page's own directory; `http(s):`, `data:` and protocol-relative URLs are skipped; `<video src>`, `<source src>` and inline `<style>`/`<script>` bodies add nothing beyond the HTML size already counted. A local target that does not exist is reported once as `budget: <page> missing asset <href>` (warning) and counts 0. Pages whose bytes exceed `byte_budget_kb × 1024` (config, default 150) are reported as `budget: <page> <kb> KB > <limit> KB` with `<kb> = Math.round(bytes / 1024)` (warning in v0.1). `<page>` is the site-relative URL path (`/AEP/step-02-cap/`).
8. **check: carbon figure.** For each step page, `gco2e = new co2({ model: 'swd', version: 4 }).perByte(bytes)` from `@tgwf/co2`; `check` writes `<root>/build/carbon.json` in the contract shape via `canonicalJson` plus one trailing `\n`. The test compares the file's values with the library called directly on the same byte counts (this verifies the wiring only, not the model's science, which is CO2.js's responsibility).
9. **check: exit codes and summary.** `check` prints `errors: N, warnings: N` last (stdout) and exits 1 if errors > 0, otherwise 0; `--strict` promotes warnings to errors (the v0.2 behaviour, opt-in now). Without `--dist`, the budget and carbon steps are skipped with no warning.
10. **No shell interpolation.** All process spawning uses `execFile`/`spawn` with argument arrays; a test reads every file under `packages/cli/src` and asserts none contains `exec(` (other than `execFile(`) or `shell: true`.
11. **Project root discovery.** Without `--project`, commands walk up from `cwd` to the first directory containing `docsandeye.config.yaml`; failing that, they exit 66 with `no docsandeye.config.yaml found (run docsandeye init)`.
12. **Package hygiene.** `npm run build -w docsandeye` emits `dist/bin.js` whose first line is `#!/usr/bin/env node`; `npm test` passes; the CLI is ESM and imports `@docsandeye/core` only through its public exports (a test greps `src/` for `@docsandeye/core/` deep imports and finds none).

## Out of scope

- No Starlight/Astro build invocation (`astro build` remains the site's own script); no dev server.
- No video encoding, posters, captions, Whisper, or hosting uploads.
- No GitHub Actions workflow files. No Lighthouse; the budget is static analysis of `dist/`.
- No edits outside `packages/cli/**`; do not edit `README.md`, `TODO.md`, `CHANGELOG.md`, `.vs/tasks.json`, `.vs/progress.md`.
- No changes to `@docsandeye/core` or `render/` — if a contract is insufficient, report it in the generator report rather than patching around it.

## Test location

`packages/cli/test/` (vitest). Generator scratch tests only under `.vs/cycle-<N>/scratch-tests/`.

## Proposed budget

3 cycles. Rationale: wiring, but with real git and process boundaries that need care in tests.

## Model plan

- Generator: **opus**, ceiling fable (pre-authorised). Rationale: scoped wiring over settled contracts; Opus is near-parity here and Fable buys little.
- Spec Critic: sonnet. Tester: haiku, ceiling sonnet on test-quality findings.
- Fable rung: pre-authorised (--fable-subagents) but not the starting tier.
