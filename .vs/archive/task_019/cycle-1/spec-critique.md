# Spec critique — task_019 (cycle 1)

Ground truth checked: `packages/core/src/export-plan.ts`, `packages/core/src/hosting.ts`,
`packages/core/src/schemas.ts`, `packages/core/src/load.ts`, `packages/cli/src/export.ts`,
`packages/cli/src/common.ts`, `packages/core/fixtures/aep-like/**`,
`packages/core/fixtures/export-expected/**`, `packages/core/test/export-plan.test.ts`,
`packages/cli/test/export.test.ts`. `{step}` verified against GitBuilding's own docs via
WebSearch (`gitbuilding.io/usage/buildup`): appending `{step}` to a link is documented,
real GitBuilding syntax for marking a link as a build step — not a spec-invented tag. No
concern raised on that point.

## Concerns

### 1. BLOCKING (AC5) — `export-local` buildup file count contradicts the fixture's own step count

Spec, Fixture section: "ONE step `step-01` with `parts: [{component: widget}]`, `media: [clip-a, clip-b]`".

Spec, AC5: "prints `exported 2 buildup files, 1 okh manifest, 1 assets copied`".

`ExportPlan.buildup` is `[buildconf.yaml, index.md, ...one file per step]` (plan item 1: "`buildup` gains this entry FIRST, before `index.md`"; existing code already puts one file per step after `index.md`). Applying the exact arithmetic the spec itself uses for `aep-like` — "N counts `buildconf.yaml` too (so the `aep-like` fixture prints `exported 5 buildup files, ...`)", i.e. 2 (buildconf + index) + 3 steps = 5 — `export-local`'s ONE step gives 2 + 1 = **3**, not 2.

Two incompatible readings:
- **(a)** The Generator computes `plan.buildup.length` mechanically from the fixture as specified (buildconf.yaml + index.md + step-01.md = 3) and the Tester hand-derives 3 from the same fixture description, both contradicting the literal string `exported 2 buildup files, ...` given in AC5 — a byte-for-byte assertion the Tester is told to write.
- **(b)** The Tester takes AC5's "2" as ground truth (it's an acceptance criterion, not prose) and asserts it literally, which is only arithmetically consistent if `export-local` has **zero** steps in `buildup` — contradicting the fixture section's explicit "ONE step `step-01`".

One of "ONE step" or "2 buildup files" is wrong; nothing in the spec says which. This needs the chair to fix the number (almost certainly AC5 should say 3, matching the aep-like formula) before Generator/Tester can agree on the summary-line assertion.

### 2. BLOCKING (AC3, AC4, AC5) — `export-local`'s video media manifests are missing fields `MediaSchema` requires, and the fixture section reads as exhaustive

Spec, Fixture section: "two video manifests `clip-a` (`file: assets/clip-a.mp4`, hero `widget@<its version>`) and `clip-b` (`file: assets/clip-b.mp4`, same hero)".

`MediaSchema` (schemas.ts) requires, unconditionally, `shot_date` (ISO date) and `shot_by` (string), and — via the `superRefine` for `type: 'video'` — also requires `poster` and `duration_s` ("required for video"). None of `shot_date`, `shot_by`, `poster`, `duration_s` are named for `clip-a`/`clip-b`.

Two incompatible readings:
- **(a)** The parenthetical field list is the complete spec for these manifests (it's written the same way — "id (key: value, key: value)" — as every other exhaustively-specified fixture entity in this task, e.g. the `widget` component and `step-01`'s parts/media). Built exactly as listed, `parseMedia` throws (`poster required for video`, `duration_s required for video`, plus missing `shot_date`/`shot_by`), the fixture never loads, and AC3/AC4/AC5 (all of which depend on `export-local` loading) are unreachable.
- **(b)** The trailing clause "Copy field shapes from `aep-like` so the loader accepts it" is meant to silently backfill `poster`, `duration_s`, `shot_date`, `shot_by` (and presumably a `licence`, since `aep-like`'s video manifests carry one) with values of the Generator's own choosing. This is workable — AC3's export-local check only asserts the two `href`s, not full line text — but it means the fixture's exact byte content is genuinely unspecified beyond `file`/`hero`/id/type, so a Tester writing any assertion beyond href (as they did for `aep-like`'s hand-derived full-line checks) has no normative values to check against, and two independent implementers could produce different (both "valid") fixtures.

Recommend the spec state the literal values for the four missing fields (or explicitly say "any ISO date / any non-empty string / any path string — untested"), the way it does for every other fixture entity.

### 3. MINOR (informational, no test impact) — the stated reason for special-casing provider `local` doesn't hold against `hosting.ts`

Spec, plan item 3: "for hosting provider `local`: the manifest's `file` path as written ...; for every other provider: `resolveMediaUrl(model.config.hosting, manifest.file)`" (i.e., two different code paths).

`hosting.ts`'s `localProvider.resolve` is `resolve(file) { return file; }` — no join, no encoding. So `resolveMediaUrl(hosting, file)` for `hosting.provider === 'local'` already returns `file` unchanged, byte-identical to the spec's special-cased branch. The two readings don't diverge in output today, so this isn't a correctness bug and doesn't affect any AC's bytes. Flagging only because: (a) the task's own ground-truth list asked me to verify this, and the premise doesn't hold; (b) a Generator who notices the equivalence and "simplifies" to always calling `resolveMediaUrl` would still pass every current test, but would silently change behaviour the moment `localProvider.resolve` ever stops being a no-op (e.g. if it gained the same percent-encoding `joinBase` does) — worth the Generator implementing the branch as literally specified rather than the shortcut, and the Tester not treating current output-equivalence as license to skip testing the `local` branch as its own case.

### 4. MINOR (AC4) — "DISTINCT media manifest" doesn't define distinctness when two ids share a `file`

Spec, plan item 4: "one entry per DISTINCT media manifest referenced by any exported step".

Not exercised by either fixture (`aep-like`'s three manifests and `export-local`'s two both have distinct `file` values), so it doesn't block cycle 1. But the wording doesn't say whether "distinct" means distinct by **manifest id** (so two media ids pointing at the same physical `file` would produce two `{from, to}` asset entries with identical `from`/`to` — a harmless but pointless duplicate copy) or distinct by **`file`** (dedup on the physical path, at most one entry per file regardless of how many ids reference it). A Generator and Tester could reasonably pick either without contradicting any current AC; flagging so a future fixture exercising this edge case doesn't surface a silent disagreement.

## Verdict

revise
