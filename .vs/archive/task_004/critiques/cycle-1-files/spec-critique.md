# Spec critique — task_004 (cycle 1)

## Concerns

1. **[BLOCKING][AC6]** The recipe `git log -1 --format=%H -S'design_version:' -- <component yaml>` does not find "the commit that last changed the version." `-S` (pickaxe, default string mode) fires only when the **occurrence count** of the literal string differs pre/post-commit. Editing `design_version: 1.0.0` → `design_version: 1.1.0` keeps the substring `"design_version:"` present exactly once on both sides, so `-S` does **not** match that commit — it matches only the commit that first *added* (or removed) the key, typically the file's creation commit. As specified, `versionCommit` will almost always resolve to file-creation, making the guard fire spuriously on nearly every component whose source was ever touched afterward. The fix is `-G'design_version:'` (regex line-diff mode) or an equivalent line-aware recipe — this needs to be pinned as normative, not left as "or an equivalent that the spec's test can reproduce," which lets Generator and Tester each invent a different recipe and never disagree in a way that surfaces the bug.

2. **[BLOCKING][cross-cutting: AC2, AC3, AC6, AC7, AC8, AC12]** Confirmed by inspecting the actual worktrees: task_004's checkout contains none of task_001's root scaffolding (no root `package.json`/workspaces, no `packages/`) and none of task_002's `render/` tree. Yet AC2 requires `@docsandeye/core`'s `parseConfig`/`loadProject` to run against generated output, AC6 requires importing `checkVersionBumps`, AC12 requires `npm run build -w docsandeye` (which needs an npm-workspaces root that only task_001 creates), and AC3/AC7/AC8 assume a real `render/` sibling and a working monorepo layout. The spec never states whether the chair merges task_001/002 into task_004's worktree before Generator cycle 1, or whether the Generator must synthesize its own minimal stand-in root/package for isolated testing. Left unresolved, the Generator cannot even run `npm install` for its own test suite, let alone AC12's build step.

3. **[BLOCKING][AC3]** "the path of the `render/` directory shipped alongside the CLI" is self-contradictory: task_002 places `render/` at the **repo root** (sibling to `packages/`), and this task's own Out-of-scope list forbids editing or copying `render/**` into `packages/cli`. Nothing "ships alongside" the CLI package; the exact relative offset from the CLI's install location to the top-level `render/` directory (e.g. `path.resolve(<cli-pkg-dir>, '../../render')`) is never pinned. Worse, since the fixture test uses a fake `python3` that ignores `PYTHONPATH` content and always logs+exits 0, a wrong resolution formula would pass every test in this suite yet fail at real integration — the one place this matters most is exactly the place no test can catch it.

4. **[BLOCKING][AC7]** "target resolved against `<dir>`" doesn't disambiguate root-relative (`/assets/x.css`) from page-relative (`../assets/x.css`) hrefs — real HTML resolves the latter against the referencing file's own directory, not the dist root, and the spec never states that Astro's build is assumed to emit only root-absolute asset paths (if that's the intended simplifying assumption, say so explicitly). It also never says what happens when a resolved local path doesn't exist on disk — error, warn, or silently count as 0 bytes — leaving a real failure mode untested.

5. **[BLOCKING][AC7]** `srcset` (on `<img>` and `<picture><source>`) is absent from the enumerated attribute list entirely, with no stated rationale for excluding it. Astro/Starlight commonly emits responsive `srcset` candidates; silently dropping them either significantly undercounts real initial-load weight or is a deliberate scope cut that needs to be said out loud, since a Tester fixture including `srcset` has no spec text to test against.

6. **[BLOCKING][AC7]** The report line `budget: <page> <kb> KB > <limit> KB` is specified as an exact string (mirroring AC6's violation string) but the rounding/format of `<kb>` is never pinned (integer? one decimal? floor/round/ceil?). An independently-authored Tester fixture whose byte count lands on a rounding boundary can legitimately disagree with the Generator's choice — pin e.g. `Math.round(bytes/1024)`.

7. **[BLOCKING][AC7 & AC8]** Neither AC defines the exact string shape of "page path" used as the `carbon.json` key (repo-relative file path with/without `index.html`? URL path with/without leading slash and trailing slash?), and unlike `render-plan.json`/`staleness.json` in task_001, AC8 gives no worked JSON example to anchor it. This key is a contract with task_003's plugin (which reads the file at build time) — a task explicitly outside the two contracts this critique was scoped to check — and AC7's `docsandeye:step` meta tag is likewise an assumption about task_003's emitted markup with no textual guarantee it matches. Because the CLI's own `dist/` test fixtures are Generator-owned, this suite can trivially pass by fabricating a meta tag and page-path convention that never gets checked against what task_003 actually produces.

8. **[MINOR][AC8]** "pin against the library's own output" only proves check.ts calls `@tgwf/co2` with the right parameters (model, version, bytes) — it cannot catch a wrong or scientifically bogus carbon figure, since both sides of the assertion share the same library call. That's a reasonable, deliberate tradeoff for v0.1 wiring, but the AC's wording should say so plainly rather than implying the test validates the carbon estimate itself. Also unstated: should `carbon.json` reuse core's exported `canonicalJson` (for serialization parity with `staleness.json`) or is ad hoc key-sorting acceptable?

9. **[MINOR][AC2]** "refuses … unless `--force`" never specifies `--force`'s actual overwrite semantics (wipe-and-recreate the whole `<dir>`, overwrite only colliding template filenames, or skip the guard while leaving unrelated existing files untouched) — three different behaviors are all "spec-compliant" as written.

10. **[MINOR][AC6]** The exact wording of the "non-git directory: warning, not error" message, and the detection mechanism (e.g. `git rev-parse --is-inside-work-tree` vs. catching a spawn failure), are unpinned. Low risk since AC6 doesn't require an exact string here, but worth naming so Generator and Tester don't build incompatible fixtures for "what counts as non-git."

## Verdict

revise

## Iteration 2 — Concerns

**Iteration-1 resolution check — all 10 resolved:**
1. `-G'^design_version:'` now pinned (was `-S`). Resolved.
2. Sequencing commitment added: Generator dispatched only after task_001/002 merge + rebase. Resolved.
3. `<renderDir>` formula pinned with explicit repo-root offset, disambiguated as relative to `packages/cli/` itself (not `dist/`); consistent with `render/` at repo root per task_002. Resolved.
4. Root-absolute vs page-relative href resolution and missing-asset handling (warn, count 0) both pinned. Resolved.
5. `srcset`/`<source srcset>` largest-candidate rule added. Resolved.
6. `<kb> = Math.round(bytes / 1024)` pinned. Resolved.
7. `carbon.json` worked example + key derivation now cross-checked against task_003 spec (`carbon.json (normative here; task_004 writes it...)`, same example, same key convention) — genuinely consistent, not just parallel prose. Resolved.
8–10 (canonicalJson-for-carbon, `--force` semantics, non-git message/detection): all pinned as described. Resolved.

**New concerns:**

1. **[BLOCKING][AC6/AC9]** Error-vs-warning classification of the primary guard-violation line (`guard: <component>: source changed in <sha7> but design_version is still <version>`) is never stated — unlike its two sibling AC6 messages and both AC7 messages, which are explicitly parenthesised `(warning)`. AC9's `errors: N, warnings: N` / exit-1-iff-errors>0 contract needs every reportable line classified; a Generator and Tester can each plausibly default this one differently (treat-as-error-by-omission vs. treat-as-warning-like-its-neighbours), producing a genuine exit-code disagreement on the AC6 test. Pin it explicitly, e.g. "(error)".

2. **[BLOCKING][fixtures]** `fake-bin/python3`'s log-line schema (field names for argv/env/cwd in the JSON object written to `$DOCSI_FAKE_PYTHON_LOG`) is unpinned, unlike task_002's fully-spelled-out fake-openscad argv contract. Fixtures are Generator-owned but consumed by Tester-owned tests (per the package-layout split) — without agreed key names (e.g. `{"argv":[...], "cwd":"...", "env":{...}}`), Tester's independently-written assertions on "argv, cwd and PYTHONPATH" can mismatch the Generator's actual field names for reasons unrelated to correctness.

3. **[MINOR][AC6]** The "unchecked" case (`no git history for its source files`) is stated in the same sentence as the single-component violation scenario, but that scenario's repo only ever has one component with git history; it's unclear whether "unchecked" is exercised in the same temp repo (needs a second component with source files but no commits touching them) or a separate one. Worth an explicit second fixture step.

4. **[MINOR][AC6]** `<sha7>` in the violation string isn't derived: `sourceCommit`/`versionCommit` facts are full `%H` hashes, so is the message's abbreviation `hash.slice(0,7)` or git's own `--short` abbreviation (which can be <7 chars in a tiny test repo)? Pin the truncation method so the exact string is reproducible.

5. **[MINOR][AC3]** The "`canonicalJson(...)` with a trailing newline" phrasing doesn't itself contradict task_001's `canonicalJson` definition (which says nothing about trailing newlines either way), and the sequencing commitment means task_001's actual implementation is inspectable, real code by the time this Generator runs — low risk, but if canonicalJson's own output already ends in `\n`, this wording could produce a double-newline file. Worth a one-line note that the CLI appends the newline itself regardless of `canonicalJson`'s own output.

Checked and found consistent (no new issue): the Python argv's `--project-root .` against `cwd = <root>`, matching task_002's own `render-plan.json` example (`"project_root": "."`) and its `render(job, project_root: Path, …)` contract — both sides agree cwd carries the real location and `.` is deliberate, not a placeholder.

## Iteration 2 — Verdict

revise

## Iteration 3 — Concerns

**Iteration-2 resolution check — all 5 resolved:**
1. Guard-violation line now carries `(error; <sha7> = the first 7 characters of the full %H hash, never git's own abbreviation)` — classification and truncation method both pinned in one clause (AC6). Resolved (also resolves old #4).
2. `fake-bin/python3` log-line schema fully spelled out: `{"argv": [...], "cwd": "<cwd>", "env": {"PYTHONPATH": <string or null>}}` (package layout). Resolved.
3. "the same temporary repository also contains a second component whose source file exists on disk but has never been committed" (AC6) — explicitly the same repo, an explicit second component. Resolved.
4. (was #4, folded into #1 above.)
5. AC8's carbon.json wording ("via `canonicalJson` plus one trailing `\n`") relies on AC3's now-stated fact that canonicalJson emits no trailing newline; no double-newline ambiguity, no contradiction between the two ACs' phrasing.

No new contradiction: grepped `(error)`/`(warning)` — exactly one error (the guard-violation line) and three warnings (unchecked-component, non-git, missing-asset, over-budget lines), each matching the classification already implied in iteration 1/2; `sha7` and `DOCSI_FAKE_PYTHON_LOG` each defined once, used consistently; the two `trailing` hits are unrelated concerns (carbon.json's URL-key trailing slash vs. the render-plan/carbon.json trailing newline) and don't conflict.

## Iteration 3 — Verdict

pass
