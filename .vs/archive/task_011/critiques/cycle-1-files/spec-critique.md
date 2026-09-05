# Spec Critique — task_011, cycle 1

## Concerns

1. **BLOCKING (AC6 / Plugin normative).** `StalenessDetails.astro` is only invoked
   for `status === 'STALE'` media (`MediaPane.astro`'s `stale` filter); a
   `CHANGED_IN_FRAME` record goes into the `inFlow` list and renders via
   `MediaItem.astro`/`VideoBlock.astro` instead, never touching
   `StalenessDetails.astro`. AC6's vid-02-seat case (vial-cap 1.0.0→2.0.0,
   whose overall status *is* CHANGED_IN_FRAME, confirmed against the fixture)
   can therefore never reach the `<docsi-diff>` markup the "Plugin
   (normative)" section says to insert into `StalenessDetails.astro`, and
   `MediaItem.astro`/`VideoBlock.astro` are not in the edit-ownership list.
   The spec needs either a different insertion point for CHANGED_IN_FRAME or
   an ownership grant for those two files.

2. **BLOCKING (AC6 / fixture).** No step in `fixtures/project/docs/steps`
   declares a `viewer:` for `top-stop` (only `step-02-cap.md` declares
   `viewer: {component: vial-cap, format: glb}`), and
   `build/render/manifest.json` has no top-stop viewer job. The normative
   `<docsi-diff>` worked example is for top-stop with *both* figures, and
   AC6 requires "the current viewer GLB exists in the render manifest" for
   that same case — unattainable without adding a `viewer:` field to a step
   plus a new render-manifest job/placeholder `.glb`, neither of which is in
   Ownership (only `build/render/old/**` is listed as Create). Separately,
   the general "which step's viewer names this component" lookup (needed for
   any component, not just vial-cap) isn't specified anywhere — `view.ts`'s
   `renderJobFor` takes a pre-known `renderId`/`format`, and nothing maps an
   arbitrary stale component id to the step that declares its viewer.

3. **BLOCKING (AC8, task_008 consistency).** AC8's "under 32 KB" for the
   combined registering script conflicts with two pre-existing hardcoded
   tests — `video.test.ts:154` and `build.test.ts:362` — that assert the same
   bundled script (all `customElements.define(...)` in one module) stays
   under `30 * 1024` bytes. Neither test is Tester-owned or in the Edit list,
   so they can't be bumped to 32 KB, yet `elements/index.ts` (which the spec
   has Generator edit to register `docsi-diff`) feeds exactly that bundle.
   The spec must either reconcile the two numbers or grant permission to
   raise the existing threshold.

4. **BLOCKING (AC9, .gitignore).** No `.gitignore` file is anywhere in
   Ownership (Create or Edit), yet AC9 requires `build/render/old/` to be
   "under the existing build/-ignored paths or explicitly ignored." The root
   `.gitignore` ignores only `build/media/`, not `build/render/`; `docsandeye
   init`'s template ships no `.gitignore` at all for scaffolded projects. As
   written this AC has no file it's allowed to change to satisfy itself.

5. **MINOR (git recipe quoting).** `-G'^design_version: <version>$'` is
   written shell-quoted for exposition, but `git.ts` uses `execFile` with an
   argv array (no shell) — passed literally, the quote characters become
   part of the regex and it will never match. State explicitly that the
   `-G` argv element carries no surrounding quotes.

6. **MINOR (git recipe robustness).** The `$`-anchored exact-match regex
   will silently miss if the YAML line is quoted (`design_version: "1.0.0"`)
   or carries a trailing comment, falling through to "no commit with
   design_version". Worth a one-line note that this relies on docsandeye's
   own YAML always emitting the bare unquoted form (true today, not schema
   enforced).

7. **MINOR (git recipe, root commit).** When `<sha>` has no parent,
   `git show <sha>^:<file>` fails rather than returning content lacking the
   string — say explicitly that a failed git-show counts as "does not
   contain," so the "else <sha> itself" fallback doesn't need special-casing.

8. **MINOR (AC1 fixture coverage).** `core/fixtures/aep-like` has no
   component with both a `.glb` and `.stl` derived file, so "candidates
   ordered glb-first" is exercised only by the hand-built test job, never by
   the fixture — consistent with what AC1 already says, but worth the Tester
   confirming the hand-built case actually mixes extensions.

9. **MINOR (AC3).** Should state the test's committed derived `.stl` (both
   commits) must be a well-formed *binary* STL, since it's later fed to
   `glb.stl_to_glb`, which rejects ASCII STL — git preserves bytes regardless
   of format, but the round-trip needs a real binary fixture, not just any
   bytes.

10. **MINOR (docsi-model API).** `docsi-model` exposes no public getter or
    event for its lazily-created `<model-viewer>` (private `#button`, no
    "loaded" event, viewer created only after a manual click) — "if it
    exposes one" always resolves to "it doesn't," so camera-linking is dead
    code. Fine per Out-of-scope §3, but state it plainly instead of leaving
    it conditional.

## Verdict

**revise**

## Iteration 2 — Concerns

**Iteration-1 resolution audit — all 10 resolved.**
1–2 RESOLVED: scope narrowed to STALE-only (AC6: "CHANGED_IN_FRAME media render no `<docsi-diff>`"), so the routing mismatch is moot; `step-05-topstop` + a render-manifest viewer job for `top-stop@1.3.0` are now in Ownership, with the hash explicitly "computed with core's `renderJobKey`" — deterministic (sha256 over canonical JSON, exported from `core/src/index.ts`) and reproducible by both Generator and Tester without guessing.
3 RESOLVED: AC8 now caps the new element at "under 2 KB" and directs the Tester to leave the two pre-existing 30 KB assertions (`video.test.ts:154`, `build.test.ts:362`) unchanged — no threshold conflict.
4 RESOLVED: root `.gitignore` is now Create-owned with the exact line.
5–7 RESOLVED: `-G` argv-no-quotes, bare-unquoted-YAML reliance, and the root-commit "failed git show counts as not containing" rule are all stated explicitly.
8–9 RESOLVED: folded into AC1/AC3 text directly (mixed-extension hand-built job; binary STL via `struct`).
10 RESOLVED: Out-of-scope now states plainly "no viewer API exists" (verified: `docsi-model` has no public getter/event) rather than a conditional.

**New concern (BLOCKING): `step-05-topstop`'s guide assignment breaks an existing, non-owned test.**
For `AEP/step-05-topstop/index.html` to exist (AC6), the step needs `guide: aep` — `step-04-orphan.md` (`guide: []`) confirms a step with no guide membership produces no route, so `aep` membership is unavoidable given AC6's literal path. That makes it the third `aep` step (after `step-01-raft`, `step-02-cap`), but `build.test.ts`'s AC10 test hardcodes `items.length).toBe(2)` for `AEP/index.html`'s `ol.docsi-guide-steps li` and asserts exactly two `{step, title, parts-count}` triples (lines ~495–511). `build.test.ts` is in neither the Edit nor Tester-owned list ("Nothing else"), so nothing may update that assertion to 3 — as written, AC9's "full vitest ... green" is unattainable. (Checked and clear: AC3's route list, AC7's sidebar order check via `indexOf`, and AC8's reshoot table (`rows.length===3`, unaffected since top-stop is already a row) do NOT regress — only this one guide-index count does.) Fix: extend the Tester-owned list to include `build.test.ts`'s AC10 `describe` block (bump to 3 items, add the `step-05-topstop` triple), or explicitly reconcile another way — but some Ownership grant is required.

**Checked, no issue found:** the copy-step requirement ("copies `build/render/old/*.glb` to `dist/_docsandeye/render/old/`") looked like a gap since `assets.ts`'s `collectStaticAssets` isn't Ownership-listed, but `integration.ts` (Edit-owned) already hosts a sibling collector (`collectMediaOutputs`) merged into the same `copyStaticAssets` call — a new old-geometry collector belongs there, no new file access needed. AC6's `vid-04-old-nogeom` (hero `vial-cap@1.0.0`) is correctly STALE per `staleness.ts` (`vial-cap` is now `2.0.0`). `--force` vs `cached` interacts sensibly (AC4).

## Iteration 2 — Verdict

**revise**

## Iteration 3 — Verdict

**pass**
