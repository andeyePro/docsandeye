# Spec Critique — task_008 (cycle 1)

## Concerns

1. **[AC8, BLOCKING] Strict-default flip silently breaks the existing check-test suite.**
   `check.ts` already implements `--strict` (default `false`). Flipping the
   default to strict promotes every warning to an error. `runGuard` emits
   `warnings.push('guard: not a git repository, version-bump guard skipped')`
   whenever the project root isn't a git worktree — and `test/cli.test.ts`'s
   `tempDir()` (`fs.mkdtempSync(os.tmpdir())`) never git-inits. So the AC9
   test **"exits 0 when no errors"** (cli.test.ts ~571, calls `check
   --project tmpProject` with no `--dist`) will flip from `errors: 0` /
   exit 0 to `errors: 1` / exit 1 the moment the default changes — a
   concrete, deterministic regression, not a hypothetical one. Several
   other `--dist` tests (lines 419–535) are safe only because they wrote
   `toBeLessThanOrEqual(1)`, evidently anticipating this — but the spec
   never says so or lists which existing assertions must be rewritten
   vs. left alone. AC8 should enumerate the exact tests that must change
   (or move the whole default-mode `check --dist` block onto `--no-strict`)
   so Tester doesn't discover this by a failing `vitest run`.

2. **[AC9, BLOCKING] Degraded-mode markup (no media manifest) is unspecified.**
   The normative markup contract (lines 13–23) assumes a manifest: two
   `<source>` pairs, `data-renditions`, banner. AC9 says the no-manifest
   fixture must still render `<docsi-video>` "with only the authored poster
   and the `<noscript>` link" — but gives no markup for this shape. Does
   `<video>` still exist with zero `<source>` children? Is `data-renditions`
   `""`? Is `data-status` still present? Without an exact contract this
   AC is not mechanically checkable the way AC2–4 are.

3. **[AC9, MINOR] "the manifest's `file`" is ambiguous.** The media
   manifest (task_007's schema) has no `file` field — outputs are
   `av1_720`/`h264_720`/`poster`/`captions`. The `noscript` fallback target
   is presumably the project's own `media.file` (e.g.
   `assets/video/vid-02-seat.mp4`, already copied by v0.1's
   `collectStaticAssets`), not anything in `build/media/manifest.json`.
   Reword to name the actual field.

4. **[AC2/markup contract, BLOCKING] `data-renditions` source of truth and
   the media-manifest TS shape are not normative.** Unlike `RenderManifest`
   (data.ts has an explicit interface + shape validation), nothing defines
   the media-manifest interface `loadDocsandeyeData` must produce, nor
   states whether `data-renditions` is derived from
   `outputs` key presence (`av1_1080`/`h264_1080`) or from
   `!skipped_renditions.includes(1080)`. Both should agree on a
   well-formed manifest, but the spec should pick one as normative so
   Generator and Tester don't independently guess and disagree.

5. **[AC1, BLOCKING] A pre-existing hardcoded test contradicts the new
   budget.** `test/build.test.ts:350` already asserts "exactly one
   `<script type="module" src="…">` registers all three custom elements,
   under 25KB" (title string included). AC1 raises the ceiling to 30KB and
   the count to four elements, but doesn't say this specific v0.1 test
   must be rewritten (title and threshold both). Layout does grant this
   task's Tester ownership of `starlight-docsandeye/test/`, so it's
   permitted — just not called out, which risks Tester treating a red
   test as a regression rather than an expected spec-driven edit.

6. **[AC7, MINOR] The byte-budget half of AC7 is tautological, not new
   coverage.** `collectReferences` (budget.ts) has never inspected
   `<video><source>` or `<track>` — it only ever counted `video[poster]`.
   `test/budget.test.ts:465` ("counts video poster but not video src")
   already passes today against the existing `v1.mp4`/`v1.jpg` CLI
   fixture. Bundling this into AC7 alongside the genuinely new "no bytes
   before play" markup assertions invites the Generator to believe it must
   add exclusion logic that already exists; worth a one-line note that
   this sub-check is a regression guard, not new behaviour, so no new
   `budget.ts` code is expected.

7. **[Layout, MINOR] `fixtures/project-hosted`/`fixtures/site-hosted` are
   required by AC5 but absent from the Layout's file-ownership list.**
   Only `fixtures/project/**` is named. Since these are new directories,
   not edits to another task's owned files, risk is low — but for a
   harness that uses Layout for cross-task conflict detection, add them
   explicitly.

8. **[AC8, MINOR] `--no-strict` isn't a Node `parseArgs` built-in.**
   `bin.ts` uses `node:util` `parseArgs({strict: true, ...})`, which
   rejects unknown flags outright — `--no-strict` will need its own
   explicit boolean option definition (precedent: `'allow-missing'`),
   combined with `strict`'s new `default: true`. Not stated, but low risk
   given the existing kebab-case-option pattern in the same file.

## Non-issues checked and cleared

- top-stop's changelog (`1.3.0` entry) *does* fall in `(1.0.0, 1.3.0]` via
  `changelogBetween` — AC3's exact summary/changelog is achievable with no
  fixture changelog edits.
- `vid-01-raft`/`anode@1.0.0` vs. anode's current `design_version: 1.0.0`
  correctly yields FRESH via `computeStaleness`.
- `resolveMediaUrl`'s `url-prefix` provider does `base + '/' + file`
  verbatim (not basename-stripped) — AC5's `https://media.example/build/media/…`
  form is achievable with the existing hosting seam, no core change needed.

## Verdict

`revise`

## Iteration 2 — Concerns

Iteration-1 items, checked against the rewritten spec and the actual source:

1. [AC8 strict-default] RESOLVED. Promotion is now scoped to `budget: … KB > … KB` lines only; the three warning categories are enumerated; the exact `cli.test.ts` rewrites are named. Verified against `check.ts`: the current blanket `opts.strict ? errors.length + warnings.length : errors.length` will need to become pattern-scoped, but the spec now gives Generator/Tester the same enumerated test list so this is mechanically checkable, and the "exits 0 when no errors" non-git temp-project case is correctly still green (its only warning is `guard: not a git repository…`, never promoted).
2. [AC9 degraded markup] RESOLVED. Full normative shape given (poster, single `<source type="video/mp4">`, no `<track>`, banner rule, noscript target).
3. [AC9 "manifest's file"] RESOLVED. Reworded to `media.file`, matching core's actual field (confirmed in `vid-02-seat.yaml` and `view.ts`'s `mediaUrl`).
4. [MediaManifest type / renditions source of truth] RESOLVED. Interface is now normative in `src/data.ts`'s section; OFFERED is defined by `outputs` key presence, `skipped_renditions` explicitly demoted to informational.
5. [AC1 hardcoded v0.1 test] RESOLVED. Names `build.test.ts` and its current values; verified against source — line 350/354 does read "under 25KB" / `toBeLessThan(25 * 1024)`, so "three elements, 25 KB" → "four elements, 30 KB" is an accurate, unambiguous instruction.
6. [AC7 tautological budget note] RESOLVED. "no new budget code is expected" note added verbatim as suggested.
7. [Layout: hosted fixtures] PARTIALLY RESOLVED. `fixtures/project-hosted/**` and `fixtures/site-hosted/**` are now in Ownership — but `fixtures/project-nomanifest`/`fixtures/site-nomanifest`, named explicitly by AC9, are still missing from Ownership. New finding below.
8. [`--no-strict` not a parseArgs builtin] RESOLVED. Now specified as "an explicit boolean option in `bin.ts`'s `parseArgs`".

New problems this iteration:

- **[BLOCKING] Ownership omits the AC9 nomanifest fixture pair.** AC9 requires `fixtures/project-nomanifest` + `fixtures/site-nomanifest`, following the same project-X/site-X pairing already used for `-bad-theme` and now `-hosted` — but neither appears in the Ownership list, unlike those two. This is the same class of gap iteration-1 concern 7 raised, only partially fixed. Add the pair to Ownership; if a lighter mechanism (e.g. a config flag toggling manifest lookup) were intended instead of a full duplicate fixture tree, the spec doesn't offer one — `resolveRoot`/`loadDocsandeyeData` key off the project root's filesystem, not a flag, so a real second fixture root is what AC9 actually needs.
- **[MINOR] Media-manifest error handling diverges from its siblings without comment.** `readRenderManifest`/`readCarbon` throw on a malformed-but-present file (only silently null when absent). The new media-manifest loader is null-with-a-build-warning on *either* absent or unparsable. Not wrong, but worth one clause on where that warning surfaces (a `console.warn` during the Astro build, presumably) so Generator and Tester agree on how to assert it, if at all.
- Checked and cleared: `pickRendition`'s wording reproduces every AC6 case unambiguously (including the dpr/width threshold and the `[720]`-only fallback); the degraded poster path is written generically (`<basename of poster>`), correctly matching the fixture's actual `.jpg` authored poster rather than assuming `.webp`.

## Iteration 2 — Verdict

`revise`

## Iteration 3 — Verdict

`pass`
