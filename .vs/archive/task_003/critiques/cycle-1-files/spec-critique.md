# Spec Critique — task_003 (cycle 1)

## Concerns

1. **[AC2] BLOCKING.** "`stepFrontmatterSchema` … rejects the same malformed inputs as core's `parseStep`" is impossible for the id-mismatch case: `parseStep`'s id-vs-filename check needs the filename, which a Zod schema handed only to `docsSchema({ extend })` never receives. The "shared test table of ≥3 cases" must explicitly exclude id-mismatch (and any other filename-dependent check) or this AC cannot be satisfied as written.

2. **[AC4/AC9] BLOCKING.** No file in the package layout owns copying `build/render/*` (and media/GLB files) into `dist/_docsandeye/render/…`. This needs an explicit hook (e.g. `astro:build:done`) named in the layout. Left unspecified, the Generator may instead reach for Astro's `astro:assets` `<Image>`/`<Picture>`, which pulls in `sharp` — a native-binary dependency that may fail to install/build in this container. Spec should mandate plain `<img src>` + a manual static copy step, and state explicitly that `sharp` is not a dependency.

3. **[Cross-task contradiction] BLOCKING.** The plugin constructor takes `theme?: string` (`docsandeye({theme: 'nope'})`, AC1), but task_001's `docsandeye.config.yaml` already has a normative `theme` field (default `"starlight"`). Nothing states which wins when both are present, whether the plugin option is even wired to anything beyond the AC1 error-path test, or whether real theme selection should come from the loaded project config instead. This is an unreconciled duplicate surface against the upstream contract.

4. **[AC5] BLOCKING — test-evasion risk.** "Grepping the built script for a static `import` of `three`/`model-viewer` at the top level" is not a reliable signal post-bundling: Rollup/Vite inlines a statically-imported module's code and removes the `import` keyword entirely, whereas a genuine `import()` call is preserved as literal syntax pointing at a split chunk. So a Generator that *does* import the library statically will show no `import` text to grep for (the library's code is simply present, contributing to size) — the grep can pass while the real requirement is violated. The 25 KB budget is a partial backstop but only if the library isn't small/tree-shaken. Needs a sounder check (e.g. assert the registering script's chunk has no static dependency edge to a three/model-viewer chunk in the build manifest, or assert the dynamic-import chunk file only exists post-interaction in a real browser check — infeasible headlessly here either way).

5. **[AC6] BLOCKING.** The stale-banner copy is hardcoded to "A photo exists for this step, but…", assuming the STALE entry is always a photo. But task_001's `aep-like` fixture spec (the only upstream contract in scope) only guarantees "exactly one STALE… exactly one CHANGED_IN_FRAME… rest FRESH" among "≥2 videos and ≥1 photo" — it never pins media *type* to staleness status. Task_003's fixture reuses that exact fixture (`../../../core/fixtures/aep-like`) without owning it, so this AC's premise is not guaranteed by anything task_003 controls, and the wording doesn't generalize to a STALE video.

6. **[AC7] BLOCKING.** "within 30 days of build date (fixed by `DOCSANDEYE_BUILD_DATE` env, default now)" is non-deterministic unless the spec pins the exact `DOCSANDEYE_BUILD_DATE` value the Tester must pass, chosen relative to the fixture's actual changelog dates. As written, a test author could reasonably rely on the `default now` behavior, making the badge assertion flaky/date-dependent.

7. **[AC9] BLOCKING.** `carbon.json`'s schema (field names, units, and — critically — how "an entry for the page path" is keyed: full URL, base-relative path, with/without trailing slash) is defined nowhere in task_001, the only upstream contract in scope. Task_003 both consumes it (AC9) and re-exports it via the virtual module (AC12) without ever specifying its shape itself. This is a genuine missing-contract gap, not merely an omission of colour.

8. **[AC3 vs AC10] BLOCKING — scope ambiguity.** AC3 requires `reshoot/index.html` unconditionally in every build, while AC10 gates only the *link* to it behind `DOCSANDEYE_MAINTAINER=1`. The task summary frames `/reshoot` as a "maintainer dashboard," implying it shouldn't ship to public production builds at all. As written, an unlinked-but-fully-built maintainer page (component names, versions, staleness) always lands in `dist/`, which may be the actual intent but isn't stated as a decision — it reads as an oversight.

9. **[AC12] BLOCKING.** "a unit test imports the integration's vite plugin `load()` for the virtual id" presumes a standalone, testable export of the Vite plugin object, independent of Astro's `astro:config:setup` lifecycle. The package layout never names such an export (only `integration.ts`'s top-level `AstroIntegration` is mentioned). Without a committed symbol (e.g. `export function createDocsandeyeVitePlugin(model): Plugin`), this AC has no concrete thing to import.

10. **[AC3] MINOR.** "ordered by `order`" applied to `dist/` route files is not itself an observable property of a flat file tree — routes don't carry sequence once written to disk. This likely means "the guide index lists them in order" (already covered by AC10) and is confusingly restated here as a route-generation property.

11. **[AC10] MINOR.** "the count of parts" is ambiguous between number of `parts` entries and sum of `qty` across them.

12. **[AC5] MINOR.** No stated method for the Tester to disambiguate "the" registering script from other `type="module"` scripts Starlight itself may emit on the same pages (search index bootstrap, theme toggle, etc.) beyond informally "grep for all three `customElements.define` calls in one file" — should be made an explicit, literal test recipe.

13. **[AC2] MINOR.** The "shared test table of ≥3 cases" doesn't require the table live in one file both packages import — independently hand-typed tables in each package can silently drift out of sync over time.

## Verdict

**revise**

## Iteration 2 — Concerns

Iteration-1 status: #1 resolved (id-mismatch explicitly excluded from `stepFrontmatterSchema`, table at `fixtures/step-cases.json`). #2 resolved ("Static copy step" section + no-`sharp`/no-`astro:assets` mandate spelled out). #3 resolved (plugin option removed; theme now comes only from `docsandeye.config.yaml`, matching task_001). #4 resolved (source-level static-import check + separate model-viewer-chunk assertion replaces the post-bundle grep). #5 resolved (fixture pins concrete media types to STALE/CHANGED_IN_FRAME/FRESH; both photo and video wording given). #6 resolved (`DOCSANDEYE_BUILD_DATE=2026-09-04` pinned in the verification model, changelog date literal). #7 resolved (`carbon.json` schema, path-keying and null-fallback now normative). #8 resolved (whole `/reshoot` route, not just its link, is maintainer-gated). #9 resolved (`createDocsandeyeVitePlugin` named/exported with a concrete data-URL `import()` test). #10 resolved (route-order restatement dropped from AC3). #11 resolved ("number of `parts` entries" now explicit). #12 resolved ("the registering script" identified by content signature, not by counting module scripts). #13 resolved as far as task_003's own-package boundary allows (single committed `fixtures/step-cases.json`).

New issues found in the rewrite:

14. **[Fixture layout] BLOCKING.** `fixtures/site-bad-theme` is "same site whose project config sets `theme: nope`", but the only project fixture in the package layout is `fixtures/project/` (`theme: starlight`), and `docsandeye()` no longer takes a theme option (correctly, per #3) to override it inline. No second project fixture with `theme: nope` is named anywhere. AC1's `fixtures/site-bad-theme` build-failure assertion has no fixture that actually produces that condition — needs a named `fixtures/project-bad-theme/` (or equivalent) added to the layout.

15. **[AC4/data.ts] BLOCKING.** The fixture and the static-copy step both key off `build/render/manifest.json` / `renderManifest.jobs[*].outputs`, but task_001 (the only upstream contract in scope) normatively names this artifact `build/render-plan.json`, produced by `buildRenderPlan`, with `jobs[].outputs`. Nothing states whether `build/render/manifest.json` is that same artifact under a different path (drift risk: code written against core's own naming would look for `render-plan.json` and find nothing) or a distinct post-render file with its own schema — the treatment `carbon.json` got in this rewrite (exact path, exact shape) is missing here.

16. **[Fixture] MINOR.** "`guide: []` is invalid, so instead this step is omitted" isn't supported by task_001: nothing in core's step/cross-reference rules rejects an empty `guide` array (only an *absent* `guide` gets defaulted; `unknown-guide` fires only for entries not declared, and an empty array has none). The substituted test ("no route for a step in no guide" via `step-03-mep-only` not appearing under `/AEP/`) actually just re-exercises "a step routes only under its declared guide" — the real zero-guides case is silently dropped, not replaced.

17. **[AC5] MINOR.** The source-level check (no static `import` of `three`/`model-viewer`; dynamic `import()` in `docsi-model.ts`) closes the bundler-obscures-the-import loophole from iteration 1, but nothing distinguishes an `import()` fired eagerly at module top-level from one gated behind the stated "click/keyboard handler" — both pass the stated static-import-absence check and both produce the required separate chunk. That clause of AC5 is unenforced by any given recipe.

## Iteration 2 — Verdict

revise

## Iteration 3 — Concerns

Iteration-2 status: #14 resolved (`fixtures/project-bad-theme/` added — a copy of `fixtures/project` with `theme: nope` — and named in the package layout; `fixtures/site-bad-theme` points its `projectRoot` there, giving AC1's build-failure assertion a fixture that actually produces the condition). #15 resolved (`build/render/manifest.json` now carries an explicit shape and is stated distinct from core's `build/render-plan.json`, which the plugin is stated to never read — no drift risk left unaddressed). #16 resolved (`step-04-orphan` with `guide: []` added to the fixture per "core accepts an empty array"; AC3 now asserts no `step-04-orphan/` directory exists, exercising the real zero-guides case rather than the previously substituted one). #17 resolved (AC5's dynamic-import recipe now pins a literal, checkable test: the first occurrence of `import(` in `docsi-model.ts` must come after the first occurrence of `addEventListener(`, closing the eager-vs-gated ambiguity with a concrete character-offset assertion).

No new contradictions: `project-bad-theme`, `step-04-orphan`, `manifest.json`/`render-plan`, and `addEventListener` each appear once, consistently, across the package layout, fixture description and affected ACs.

## Iteration 3 — Verdict

pass
