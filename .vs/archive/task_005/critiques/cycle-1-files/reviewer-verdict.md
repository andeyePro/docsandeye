# Reviewer verdict — task_005 cycle 1

## Per-criterion assessment

1. ✓ `pioreactor.css` sets every listed `--docsi-*` and `--sl-*` token from the exact table values; header cites T9; grep for `--ifm-`, `.menu__`, `.navbar__`, `.theme-doc`, `AssemblyInstructionBlock`, `fonts.googleapis` finds nothing.
2. ✓ No font files ship (`find` for woff/ttf empty); the only `@font-face` text is prose in README.md/themes.md telling a site how to add its own; font stacks match exactly.
3. ✓ Cycle order, storage key (`docsandeye-theme`), `<html>` attrs, first-paint script, `aria-label` format, `hidden` no-JS fallback all match spec; `ThemeSelect.astro` resolves through `exports`; built pages contain `<docsi-theme` (9 of 16 pages, the ones with a nav). No `<starlight-theme-select` tag renders anywhere (a `querySelectorAll('starlight-theme-select')` string survives in Starlight's own core script but finds nothing — harmless, see Concern 1).
4. ✓ `mark-pioreactor.svg` is 0 bytes; grep confirms it is imported nowhere; README and themes.md both state the T29 + core-key precondition.
5. ✓ `check` and `render` both exit 0 with `errors: 0, warnings: 0` / `rendered 0, cached 0, hand-exported 3, skipped 0, failed 0`; only `rendered_at` differs in the manifest after a re-run.
6. ✓ `astro build` succeeds under Node 22, example guide appears at `/example/…`; spot-checked field names in all three authoring pages against `packages/core/src/schemas.ts` enums (`COMPONENT_KINDS`, `MASTER_FORMATS`, `PART_CATEGORIES`, `RENDER_VIEWS`, `RENDER_FORMATS`, `MEDIA_TYPES`) — every one matches exactly.
7. ✓ `check --dist site/dist` reports 0/0; `build/carbon.json` step-page sizes are 109264, 108471, 107828, 105867 bytes (~0.016 gCO2e each), all comfortably under the 150 KB budget.
8. ✓ Docs voice matches README: short sentences, no em dashes anywhere in the diff, commands are bare in fenced blocks. One inline (non-fenced) placeholder-style `<name>` appears in prose in themes.md describing the resolution pattern `@docsandeye/themes/<name>.css` — not a command block, borderline but not the violation the AC targets.
9. ✓ `diff --git` paths are all under `packages/themes/**`, `site/**`, `examples/**`; `.vs/spec.md`, `package-lock.json`, `TODO.md`, `CHANGELOG.md` are untouched by this cycle's diff (those are from earlier merged commits, not cycle-1).
10. ✓ No embedded Pioreactor asset: synthetic PNGs are flat colour-block illustrations (viewed directly), SVG renders are hand-drawn line art, no binary blobs beyond the tiny GLB/STL cube. README explicitly states "Nothing here is a photograph of a real product."

## Concerns

1. MINOR — `site/dist/index.html:11` (and other pages) still contains Starlight's own inline `document.querySelectorAll('starlight-theme-select')` from its core script, a dead reference now that the component is overridden. It finds nothing and does nothing, but it's a small tell that the override doesn't fully erase every trace of the replaced component. No fix required for this task; flagging in case a future Starlight upgrade changes that script's behaviour.
2. MINOR — `packages/themes/src/state.ts` has meaningful pure logic (`cycleFor`, `parseState`, `nextState`, `fromStarlight`) with zero unit tests, unlike `packages/core` and `packages/cli` which both have `test/` directories. This matches the sibling `packages/starlight-docsandeye` package (also untested), so it's consistent with this repo's established boundary of "Astro-adjacent packages go untested, core logic packages don't" — not a regression, but worth a note since this state module is more logic-heavy than typical UI glue.
3. NIT — `site/src/content/docs/themes.md` states the "re-implementation from published token values only" claim twice in adjacent paragraphs (once generally, once in "The pioreactor pack" section with near-identical wording). Mildly repetitive; not incorrect.

## Design note on the neutral mark (for Martin)

Rendered the actual mask composition (base + `mark-neutral.svg`) by hand: it produces a plain circle-with-crossbar "eye" cutout on each of the three bases (half-filled circle, sun, moon). It reads as a generic abstract icon — no resemblance to the Pioreactor triple-dot "P" mark, no letterforms, nothing trademark-adjacent. `mark-pioreactor.svg` is confirmed empty and confirmed unreferenced by any code path (`ThemeSelect.astro` only imports `mark-neutral.svg`).

## Verdict

pass
