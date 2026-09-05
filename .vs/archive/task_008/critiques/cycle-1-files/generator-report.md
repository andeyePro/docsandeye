# Generator report — task_008 cycle 1

Branch `vsss/task_008-video-ux`, worktree `/workspace/.claude/worktrees/task_008`.

Commits (on top of the task_007 merge `9c7af12`):

- `935ed5f` feat(starlight-docsandeye): `<docsi-video>` facade, stale-video flow, media manifest
- `066db46` feat(cli): check is strict by default for over-budget pages only

`.vs/cycle-1/diff.patch` = `git diff main...HEAD -- packages/starlight-docsandeye packages/cli/src`; because the range starts at `main` it also carries task_007's already-merged `packages/cli/src/encode.ts` / `bin.ts` encode additions (2053 lines in total).

## Per-AC mapping

| AC | Where | Evidence (scratch tests under `.vs/cycle-1/scratch-tests/`) |
|----|-------|-----|
| 1 Element registration | `src/elements/docsi-video.ts` (class `DocsiVideo`, no imports), `src/elements/index.ts` registers `docsi-video` fourth | `build.test.ts` "one module script defines all four elements and is under 30 KB": registering script `dist/_astro/StepPage.astro_astro_type_script_index_0_lang.CwnG00CA.js` = **6281 bytes** (v0.1 baseline 3250). The v0.1 25 KB / three-element assertion therefore still passes unchanged. |
| 2 Facade markup | `src/components/VideoBlock.astro` (`mode="flow"`), `MediaPane.astro` routes `type: video` to it | `build.test.ts` AC2: exact `<p class="docsi-banner" hidden>Recorded with Vial Cap v1.0.0, current is v2.0.0</p>`, `preload="none"`, poster `…/vid-02-seat.webp`, AV1 then H.264 with `data-height="720"`, `<track kind="captions" srclang="en" … default>`, `<noscript><a href="/_docsandeye/media/vid-02-seat-720.mp4">Download the video</a></noscript>`, `data-renditions="720,1080"`, `p.docsi-note` kept |
| 3 STALE flow | `StalenessDetails.astro` (`docsi-stale docsi-stale-video`, button, `VideoBlock mode="older"`), fixture `vid-03-old` | `build.test.ts` AC3: exact summary, one `<li>` (Chamfer on electrode bore.), `<button type="button" class="docsi-watch-older">Watch the older video</button>`, `<div class="docsi-older" hidden>` wrapping the `<docsi-video data-status="STALE" data-renditions="720">` with banner `Recorded with Top Stop v1.0.0, current is v1.3.0`, `<noscript>` after the div, renders/in-flow media precede the details |
| 4 FRESH | fixture `vid-01-raft` on step-01-raft | `build.test.ts` AC4: `<docsi-video data-status="FRESH">` inside a `<figure class="docsi-video-figure">`, no `.docsi-banner`, no `details.docsi-stale` on the page |
| 5 Copy step and hosting | `src/integration.ts` `collectMediaOutputs` (local only, existing files), `VideoBlock.astro` `outputUrl` (`resolveMediaUrl(hosting, <manifest path>)` for non-local providers) | `build.test.ts` AC5: every manifest output basename under `site/dist/_docsandeye/media/`; `site-hosted` emits `https://media.example/build/media/…` for poster/sources/track/noscript link and its `dist/_docsandeye/media/` holds no `.webm/.mp4/.vtt` |
| 6 Client helpers | `pickRendition`, `bannerText` (pure exports in `docsi-video.ts`) | `unit.test.ts`: all nine cases of AC6 plus `2g`/`slow-2g`, unknown `effectiveType`, id fallback when a pin has no `name` |
| 7 No bytes before play | server never emits `autoplay`/`preload` other than `none`; the element also strips `autoplay` and forces `preload="none"` on upgrade | `build.test.ts` AC7 over every step page of the three sites |
| 8 Strict default | `packages/cli/src/check.ts` (`OVER_BUDGET_RE`, `isOverBudgetLine`, promotion limited to those lines), `bin.ts` (`'no-strict'` boolean option, `--strict` kept as a no-op, usage text) | `cli.test.ts`: default `errors: 1, warnings: 2` exit 1; `--strict` identical; `--no-strict` `errors: 0, warnings: 3` exit 0; non-git temp project without `--dist` `errors: 0, warnings: 1` exit 0; `check --help` lists `--no-strict` |
| 9 Degraded mode | `VideoBlock.astro` (`encoded === false` branch), fixtures `project-nomanifest` + `site-nomanifest` | `build.test.ts` AC9: `data-renditions="source"`, one `<source src="/_docsandeye/media/vid-02-seat.mp4" type="video/mp4">`, poster `/_docsandeye/media/vid-02-seat.jpg`, no `<track>`, banner present, no `data-docsi-video` in any built HTML |
| 10 Tokens and styles | `src/styles/docsandeye.css`: `--docsi-banner-bg: var(--docsi-accent-low)`, `--docsi-banner-fg: var(--docsi-text)`, `.docsi-banner { position: sticky; top: 0; … }`, video/older/button rules; `packages/themes/**` untouched | `build.test.ts` AC10 (source CSS block + built CSS contains the token) |
| 11 Package hygiene | no `package.json` changed; root `npm run build` green | see commands below |

## Commands and final output lines

All run with `export PATH=$HOME/.local/node22/bin:$PATH` from the worktree root (Node v22.23.2; `npm ci` first, the worktree had no `node_modules`).

```
npm run build                               → [build] 16 page(s) built in 2.01s / [build] Complete!   (all workspaces, tsc + site)
npx vitest run --config .vs/cycle-1/scratch-tests/vitest.config.ts .vs/cycle-1/scratch-tests/unit.test.ts .vs/cycle-1/scratch-tests/cli.test.ts
                                            → Test Files 2 passed (2) / Tests 22 passed (22)
npx vitest run --config .vs/cycle-1/scratch-tests/vitest.config.ts .vs/cycle-1/scratch-tests/build.test.ts
                                            → Test Files 1 passed (1) / Tests 10 passed (10)      (builds site, site-hosted, site-nomanifest)
npx astro build   (cwd fixtures/site, DOCSANDEYE_BUILD_DATE=2026-09-04)          → 7 page(s) built / [build] Complete!
npx astro build   (cwd fixtures/site-hosted)                                     → [build] Complete!  (via the scratch beforeAll)
npx astro build   (cwd fixtures/site-nomanifest)                                 → [build] Complete!  (via the scratch beforeAll)
npx vitest run packages/core packages/themes → Test Files 10 passed (10) / Tests 188 passed (188)
npx vitest run packages/cli                 → Tests 1 failed | 53 passed (54)   (the expected `--strict` red, below)
npx vitest run packages/starlight-docsandeye → Tests 2 failed | 67 passed (69)   (the two expected reds, below)
python3 -m unittest discover -s render/tests -t render → OK (skipped=1)
```

Red-first: the scratch suites were run before implementation (module-not-found for `docsi-video.ts`; CLI `errors: 3, warnings: 0` under `--strict`, exit 64 for `--no-strict`) and went green after.

## Pre-existing tests expected to change (Tester-owned, not edited)

1. `packages/starlight-docsandeye/test/build.test.ts` › "CHANGED_IN_FRAME vid-02-seat: poster `<img>` in normal flow, `data-docsi-video="reserved"`…" — red by design: the video is now `<docsi-video data-media="vid-02-seat">` (inside `figure.docsi-video-figure`), no `<img>`, no reserved attribute. The `p.docsi-note` still follows the element.
2. `packages/starlight-docsandeye/test/build.test.ts` › AC8 "table rows: vial-cap is first…" — red by design as a consequence of the spec-mandated fixture `vid-03-old` (hero `top-stop@1.0.0`): `buildReshootIndex` sorts by `staleHeroCount` desc then component id asc, so top-stop (1) now ties vial-cap (1) and sorts first. Rows are still 3; only `rows[0]` changes to `top-stop` (with `class="docsi-stale"`); vial-cap stays present and stale.
3. `packages/cli/test/cli.test.ts` › "--strict treats warnings as errors" — red by design: `--strict` is the default no-op; the fixture's `missing asset` line stays a warning, so the last line is `errors: 1, warnings: 2`, not `warnings: 0`.
4. `packages/starlight-docsandeye/test/build.test.ts` › AC5 "…three custom elements, under 25KB" — **still green** (6281 bytes; the four-element script also contains the three defines). The spec's four-element / 30 KB rewrite is optional for correctness.

Everything else in the two existing suites is green, including the default-mode `check --dist` tests (their `toBeLessThanOrEqual(1)` hedges hold), "exits 0 when no errors", document order, STALE photo details, copied files, sidebar badges, guide index, carbon.

Calibration note for AC8's rewrite: with `packages/cli/fixtures` the default-mode summary is `errors: 1, warnings: 2` (over-budget promoted; `guard: not a git repository…` and `budget: … missing asset missing.css` remain warnings). The spec text "errors: 1, warnings: 0" does not match that fixture, which deliberately contains a missing asset.

Parsing note: `node-html-parser` treats `<noscript>` as a raw-text block by default, so `querySelector('noscript a')` returns null. Pass `{ blockTextElements: { script: true, style: true, pre: true } }` (as the scratch suite does) or read `noscript.innerHTML`.

## Ambiguity choices

- **`bannerText(status, record)` record shape**: pins may carry `name` (resolved from the model) and/or `component`; the text uses `name ?? component`. `VideoBlock.astro` resolves names via `componentName(model, id)` before calling it, so a raw `StalenessEntry` also works (ids instead of names).
- **1080 pair URL on the client**: derived from the 720 `<source src>` by replacing the `-<h>.<ext>` suffix (`renditionUrl`), the encode pipeline's fixed naming, rather than adding extra attributes that would deviate from the normative `<source>` markup. `swapRendition` then calls `video.load()` (no bytes with `preload="none"`) and only before playback has started.
- **Hosting providers other than `local`/`url-prefix`**: treated like `url-prefix` (path as written in the manifest through `resolveMediaUrl`), mirroring v0.1's `mediaUrl`.
- **Degraded `<source type>`**: `video/mp4` unless the authored file is `.webm`/`.mov`/`.ogv` (then the matching type). The fixture original is `.mp4`, so the contract's literal holds.
- **`<track srclang>`**: taken from the captions basename (`vid-02-seat.en.vtt` → `en`), default `en`.
- **Encoded job without `outputs.poster`**: falls back to the authored poster.
- **Media manifest `version`**: a present value other than `1` throws (malformed), `version` absent is accepted as 1.
- **`vid-03-old` renditions**: the fixture manifest gives it only 720 (`skipped_renditions: [1080]`) to exercise the single-rendition path (`data-renditions="720"`); `vid-01-raft` is `cached` with both pairs and no captions.
- **Ownership workarounds** (files outside the list left untouched): `MediaPane.astro` reads `mediaManifest` from `virtual:docsandeye/model` via a namespace import (`virtual-model.d.ts`, not owned, does not declare it — Astro does not type-check `.astro` at build time); the media-output copy lives in `integration.ts` (`collectMediaOutputs`) instead of `assets.ts`; `MediaItem.astro` keeps its now-unreachable v0.1 video branch (`MediaPane` never sends a video to it); the package `index.ts` does not re-export `MediaManifest` / `MEDIA_MANIFEST_PATH`.
- **`.webm` fixture placeholders** are force-added (`git add -f`) because the root `.gitignore` from task_007 ignores `*.webm`; the 34-byte posters were written as a literal 1×1 lossless WebP (`file` reports `RIFF … Web/P image`; PIL is not installed here).
- **Sticky banner vs `overflow: hidden` figures**: `.docsi-video-figure` uses `overflow: clip` so the figure is not a scroll container and `position: sticky; top: 0` on `.docsi-banner` resolves against the page.

## Unmet / follow-ups

- No AC unmet. Not verified in a browser (none available): the element's runtime behaviour (banner unhide, 1080 swap, button reveal) is covered only by the pure-function unit tests and code reading.
- `virtual-model.d.ts` should declare `mediaManifest` once its owner task touches it.
