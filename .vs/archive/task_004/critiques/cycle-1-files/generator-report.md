# Generator report — task_004 cycle 1

Commit `fdf6767` on `vsss/task_004-cli` (worktree `/workspace/.claude/worktrees/task_004`).
Touched: `packages/cli/**`, root `package-lock.json` (npm install), `.vs/cycle-1/**`.
Untouched: `packages/core/**`, `render/**`, README/TODO/CHANGELOG, `.vs/spec.md`, `.vs/tasks.json`, `.vs/progress.md`.

## Commands and final output lines

All run from the worktree root with `export PATH=$HOME/.local/node22/bin:$PATH` (Node 22.23.2, npm 10.9.8, git 2.39.5, python3 3.11.2).

| Command | Final output |
| --- | --- |
| `npm install` | `added 62 packages, and audited 65 packages in 5s` … `found 0 vulnerabilities` |
| `npm run build -w @docsandeye/core` | `> tsc -p tsconfig.json` (exit 0) |
| `npm run build -w docsandeye` | `> tsc -p tsconfig.json` (exit 0); `head -1 packages/cli/dist/bin.js` → `#!/usr/bin/env node` |
| `npm run typecheck -w docsandeye` | exit 0, no diagnostics |
| `npm test` (root vitest, projects `packages/*`) | exit 0 (no test files yet in either package; `passWithNoTests`) |
| `node --test .vs/cycle-1/scratch-tests/cli.test.mjs` (red, before any src existed) | `# pass 0` / `# fail 1` |
| `node --test .vs/cycle-1/scratch-tests/cli.test.mjs` (green, after implementation) | `# tests 26` / `# pass 26` / `# fail 0` |
| `node packages/cli/dist/bin.js --help \| head -1` | `Usage: docsandeye <command> [options]` |
| real-Python smoke: `node packages/cli/dist/bin.js render --project <tmp copy of fixtures/project> --allow-missing` | `rendered 0, cached 0, hand-exported 0, skipped 3, failed 0` (exit 0) — proves the `../../render` PYTHONPATH resolution against the real pipeline, which the fake python3 cannot |
| `git ls-files -s packages/cli/fixtures/fake-bin/python3` | `100755 …` |

## Per-AC mapping

| AC | Where | Scratch test |
| --- | --- | --- |
| 1 parseArgs, help, 0/64, `--version` | `src/bin.ts` (`main`, `parseSub`, `USAGE`/`INIT_USAGE`/`RENDER_USAGE`/`CHECK_USAGE`) | `AC1 …` (8 cases: `--help`, each sub `--help`, unknown command, no command, unknown flag, `--version`) |
| 2 init template tree, `--force`, 65 message, astro/config/loadProject checks | `src/init.ts` (`PROJECT_MARKERS`, `templateFiles`, `renderTemplate`, `runInit`), `templates/**` (8 files exactly as listed) | `AC2 …` (scaffold + `parseConfig` + `loadProject` zero problems; 65 for both marker files with exact message; `--force` overwrites template files only) |
| 3 render plan + python argv/cwd/PYTHONPATH, exit passthrough, `python3` missing → 2 | `src/render.ts` (`pythonArgs`, `pythonPath`, `runRender`, `spawnPython`), `src/paths.ts` (`renderDir`, `cliPackageDir`) | `AC3/AC4 …` (argv exact, `cwd` = realpath(root), PYTHONPATH = `<repo>/render`; `--force --allow-missing` order; inherited PYTHONPATH with `path.delimiter`; `DOCSANDEYE_RENDER_PYTHONPATH` override; child exit 2 passthrough; empty PATH → exit 2 `python3 not found: install Python 3.11+`) |
| 4 render refuses invalid project | `src/render.ts` + `src/common.ts` (`formatProblem`, `loadProjectSafely`) | `AC4 invalid project …` (stderr line form, exit 1, no plan file, fake log never written) |
| 5 check validation lines | `src/check.ts` (`runCheck`) | `AC5 …` (`docs/steps/step-03-bad.md:parts.0.component: unknown-component: …`, counted as error) |
| 6 guard from real git | `src/git.ts` (`isInsideWorkTree`, `lastCommitTouching`, `lastDesignVersionChange` with `-G^design_version:`, `isAncestor`), `src/check.ts` (`runGuard`, `componentFile`) | `AC6 …` (temp repo: create → edit+bump → edit alone → violation with `sha7 = %H.slice(0,7)`; `-G` recipe returns the bump commit not the creation commit; second component with uncommitted source → `no git history` warning; bump alone afterwards → no guard line; non-git dir → `guard: not a git repository, version-bump guard skipped`) |
| 7 byte budget | `src/budget.ts` (`findIndexPages`, `pagePath`, `resolveHref`, `srcsetCandidates`, `collectReferences`, `measurePage`, `analyseDist`) | `AC7/AC8 …` (expected bytes computed in the test from the fixture files independently of the walker; missing-asset line; over-budget line with `Math.round`; non-step `index.html` ignored) |
| 8 carbon.json | `src/budget.ts` (`gramsCo2e`, `carbonDocument`), `src/check.ts` | same test: values equal `new co2({model:'swd', version:4}).perByte(bytes)` called directly; file == `canonicalJson(doc) + '\n'` |
| 9 summary, exit codes, `--strict`, no `--dist` → skip silently | `src/check.ts` | `AC5/AC9/AC11 …` and `--strict promotes …` (`errors: N, warnings: N` last on stdout; `--strict` folds warnings into errors; no `build/carbon.json` without `--dist`) |
| 10 no shell | `src/git.ts` (`execFile`), `src/render.ts` (`spawn`) | `AC10/AC12 hygiene` (greps every `src/*.ts` for `exec(` other than `execFile(`, `shell: true`, `@docsandeye/core/`) |
| 11 root discovery, 66 | `src/paths.ts` (`findProjectRoot`), `src/bin.ts` (`resolveRoot`, `NO_PROJECT_MESSAGE`) | `root discovery walks up …` (from `docs/components`; bare dir → 66 with exact message for both `check` and `render`) |
| 12 hygiene | `package.json` (`"type": "module"`, `bin`, exact pins `@tgwf/co2` 0.19.0, `node-html-parser` 9.0.3, `yaml` 2.9.0, `@docsandeye/core` 0.1.0), `tsconfig.json`, shebang preserved by tsc | `dist/bin.js starts with a shebang …` |

## Ambiguity choices (spec silent or open to more than one reading)

- **Streams for `check`.** Problem, guard and budget lines go to **stderr**; only the `errors: N, warnings: N` summary goes to stdout (the spec annotates only the summary with "(stdout)", `render` already sends problems to stderr, and `render/docsandeye_render/__main__.py` documents the same convention: diagnostics on stderr, one summary line on stdout).
- **Ordering of check output.** Problems, then guard lines, then budget lines (errors first within each group), then the summary.
- **`--strict` summary.** Warnings are folded into the error count: `errors: E+W, warnings: 0`.
- **Budget dedup.** A resolved local path referenced more than once on a page is counted once (a browser fetches a URL once). The fixture pages never reference the same file twice, so an additive sum gives the same numbers.
- **`<img>` with both `src` and `srcset`.** Both are counted as the spec lists them (dedup covers the common case where `src` equals the largest candidate). The fixture `<img>` with a `srcset` deliberately has no `src`, so both readings agree on the fixture.
- **`srcset` missing candidates.** Each missing candidate is warned individually; the largest *existing* candidate is counted.
- **Step-page detection** queries `meta[name="docsandeye:step"]` anywhere in the document (meta is only valid in `<head>`; this tolerates parser quirks).
- **Init defaults.** `--guide` defaults to `main`, `--title` to `Hardware Guide`; the guide `base` is `/<guide>`; `--guide` must match core's `KEBAB_ID_RE` or the command exits 64. The `<file>` in the 65 message is the bare marker name (`docsandeye.config.yaml` checked before `astro.config.mjs`). `<dir>` that exists as a regular file → 65.
- **Template example component** is `off-the-shelf` / `master_format: none` with no renders, so a fresh scaffold loads with zero problems, `render` produces an empty plan and the guard has nothing to check (a scad example would need a CAD file the spec's template list does not include). `templates/package.json` pins `astro ^7.3.1`, `@astrojs/starlight ^0.42.0` (current registry), and `starlight-docsandeye ^0.1.0` / `docsandeye ^0.1.0` which are not yet published (task_003 / this package) — `npm install` in a scaffolded site will fail until they are; the spec explicitly waives package presence for the test.
- **`--dist <dir>` that does not exist** → exit 66 `dist directory not found: <dir>` (no input), rather than a counted error.
- **Component YAML path for the `-G` recipe.** `docs/components/<id>.yaml`, falling back to `.yml` when that is what exists on disk (see contract note below).
- **Extra source file** `src/common.ts` (exit codes, `formatProblem`, `loadProjectSafely`, `Io`) beyond the spec's layout list, so `render.ts` and `check.ts` share the one-line problem form without one importing the other; `src/tgwf-co2.d.ts` is an ambient typing because `@tgwf/co2` 0.19.0 ships no `.d.ts`.
- **`packages/cli/.gitignore`** re-includes `fixtures/dist/` (the root `.gitignore` ignores every `dist/`) and ignores this package's own `dist/`.

## Contract notes (worked around inside the package, nothing patched upstream)

1. **Core's guard is equality-only.** `checkVersionBumps` flags whenever `sourceCommit !== versionCommit`, so a version bump committed *after* the source edit (AC6's "nothing after a subsequent version bump", where the Tester will most naturally commit the yaml alone) would still be a violation. The CLI, which owns git, settles ordering: for each core violation it runs `git merge-base --is-ancestor <sourceCommit> <versionCommit>` and drops the violation when the bump descends from the source change (`check.ts` `bumpedAfterSourceChange`). Core's `message` field is not used; the CLI formats the spec's exact line. Worth a follow-up in core (`versionCommit` at-or-after `sourceCommit`), not done here.
2. **`ProjectModel` does not expose file paths.** `loadProject` keeps the id → file map internal, so the guard reconstructs `docs/components/<id>.yaml|.yml` by existence check. Fine for the fixed collection layout; would break if core ever loaded nested component directories.
3. **`@tgwf/co2` has no types**; ambient declaration covers `co2` + `perByte` only.

## Unmet / not verified

- Nothing in the AC list is knowingly unmet.
- Not verified in this cycle: `npm test` with real vitest tests in `packages/cli/test/` (Tester-owned; the scratch suite is `node:test` under `.vs/cycle-1/scratch-tests/`, gitignored). `vitest run` at the root passes with no test files in either package.
- Windows path behaviour (`path.delimiter` is used, `pagePath` normalises separators) is untested; the fake python3 is POSIX `sh` by spec.
