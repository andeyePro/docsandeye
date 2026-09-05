# task_008 — v0.2 video in the plugin: `<docsi-video>` facade, the stale-video flow, hard carbon gate

## Task summary

Make video first-class in `starlight-docsandeye`. A step's video media renders as a `<docsi-video>` custom element wrapping a plain `<video preload="none" poster controls playsinline>` with AV1 `<source>` first and H.264 second, choosing 720p or 1080p client-side with no library, and carrying a persistent "Recorded with <component> v<shot_with>, current is v<current>" banner whenever staleness data says the clip is not FRESH. A STALE video is demoted: renders and text first, then a `<details class="docsi-stale docsi-stale-video">` whose summary reads `A video exists for this step, but <name> has changed since it was filmed (v<shot_with> → v<current>)`, containing the changelog entries and a `Watch the older video` button that reveals the `<docsi-video>` (never autoplays, never loads bytes before the button). CHANGED_IN_FRAME keeps the video in normal flow with the one-line note. Encoded files come from task_007's `build/media/manifest.json`; when that file is absent the element degrades to the authored original. The CLI's byte-budget check becomes a hard failure in v0.2 for over-budget pages only (`--no-strict` restores the warning).

Decisions already made: video stays (explanatory power wins), lowest byte-weight that still explains; `preload="none"` facade; AV1-first, H.264 fallback; no HLS/DASH; client-side rendition pick via `navigator.connection.saveData`, `effectiveType`, `prefers-reduced-data`, `devicePixelRatio`/viewport; persistent banner during playback; CHANGED_IN_FRAME is gentler; the guide is complete with video disabled.

## Ownership (exhaustive)

Create/edit in `packages/starlight-docsandeye/`: `src/elements/docsi-video.ts`, `src/elements/index.ts` (register it), `src/components/VideoBlock.astro`, `src/components/MediaPane.astro`, `src/components/StalenessDetails.astro`, `src/data.ts` (media manifest loading + the `MediaManifest` type), `src/integration.ts` (copy step for media outputs), `src/virtual.ts` (export `mediaManifest`), `src/styles/docsandeye.css` (video, banner, tokens); fixtures: `fixtures/project/**` (add `vid-03-old`, `vid-01-raft`, `build/media/manifest.json`, placeholder encoded files under 1 KB and real 1×1 `.webp` posters), `fixtures/project-hosted/**`, `fixtures/site-hosted/**`, `fixtures/project-nomanifest/**` and `fixtures/site-nomanifest/**` (new; the nomanifest project is a copy of `fixtures/project` without `build/media/`). In `packages/cli/`: `src/check.ts` and `src/bin.ts` (strict default, `--no-strict` option). Tester-owned: `packages/starlight-docsandeye/test/**` and `packages/cli/test/**` — this task's Tester MAY edit the earlier tasks' tests there where this spec says so (AC1, AC8). Nothing else.

## Media manifest type (normative, `src/data.ts`)

```ts
export interface MediaManifest { version: 1; jobs: Record<string, { status: 'encoded'|'cached'|'skipped'|'failed'; driver: string;
  outputs: Record<string, string>; skipped_renditions?: number[]; poster_mode?: string; encoded_at?: string; reason?: string;
  source_stat?: { size: number; mtime_ns: number }; source_probe?: { width: number; height: number; duration_s: number } }> }
```

`loadDocsandeyeData` reads `<projectRoot>/build/media/manifest.json` into `mediaManifest`: `null` when the file is absent (silently, like `readCarbon`); a malformed present file throws like `readRenderManifest` does (no silent degradation on corrupt data). A rendition h is OFFERED for a video iff its job has status `encoded|cached` and both `outputs['av1_'+h]` and `outputs['h264_'+h]` exist (key presence is the source of truth; `skipped_renditions` is informational).

## Markup contract (normative)

Encoded (manifest job present, at least one rendition offered):

```html
<docsi-video data-media="vid-02-seat" data-status="CHANGED_IN_FRAME" data-renditions="720,1080">
  <p class="docsi-banner" hidden>Recorded with Vial Cap v1.0.0, current is v2.0.0</p>   <!-- present iff status != FRESH -->
  <video preload="none" poster="/_docsandeye/media/vid-02-seat.webp" controls playsinline>
    <source src="/_docsandeye/media/vid-02-seat-720.webm" type="video/webm; codecs=av01.0.05M.08" data-height="720">
    <source src="/_docsandeye/media/vid-02-seat-720.mp4" type="video/mp4" data-height="720">
    <track kind="captions" srclang="en" src="/_docsandeye/media/vid-02-seat.en.vtt" default>   <!-- iff outputs.captions -->
  </video>
  <noscript><a href="/_docsandeye/media/vid-02-seat-720.mp4">Download the video</a></noscript>
</docsi-video>
```

Server-side the lowest offered rendition's pair is emitted; the element swaps both `<source>` elements to the 1080 pair when `data-renditions` includes 1080 and `pickRendition` says so. Banner text: STALE → the first entry of `stale_heroes`; CHANGED_IN_FRAME → the first entry of `changed_in_frame`; component `name` from the model, versions `shot_with`/`current`.

Degraded (no manifest, or the job has no offered rendition): same wrapper with `data-renditions="source"`, the `<video>` has `poster` = the authored poster copied to `/_docsandeye/media/<basename>` and exactly one `<source src="/_docsandeye/media/<basename of media.file>" type="video/mp4">` (the authored original, already copied by the v0.1 static step), no `<track>`, the same banner rule, and the `<noscript>` link pointing at that same file. The v0.1 attribute `data-docsi-video="reserved"` is removed everywhere.

STALE flow: `<details class="docsi-stale docsi-stale-video">` → `<summary>` (exact string) → `<ul>` of changelog entries → `<button type="button" class="docsi-watch-older">Watch the older video</button>` → `<div class="docsi-older" hidden>` containing the `<docsi-video>`; the `<noscript>` download link is placed after the `<div>`, outside it, so it stays reachable without JavaScript.

Hosting: `config.hosting.provider === 'url-prefix'` → every `src`/`poster`/`track` is `resolveMediaUrl(hosting, <output path as written in the manifest>)` (e.g. `https://media.example/build/media/vid-02-seat-720.webm`) and the copy step skips media outputs; `local` → `/_docsandeye/media/<basename>` and the copy step copies every manifest output path that exists on disk.

Client rules (`docsi-video.ts`, pure exports): `pickRendition({ saveData, effectiveType, reducedData, dpr, width, available }: {…; available: number[] }): number` returns the lowest available when `saveData`, or `effectiveType` in `slow-2g|2g|3g`, or `reducedData`; otherwise 1080 iff 1080 is available and `dpr * width >= 1280`, else the lowest available; `bannerText(status, record)` returns the string above or `null` for FRESH. The element unhides the banner on upgrade and keeps it visible throughout playback (sticky, never removed).

## Acceptance criteria (vitest; `astro build` of each fixture site once per test file)

1. **Element registration.** The registering script defines `docsi-step`, `docsi-model`, `docsi-lightbox` and `docsi-video` and is under 30 KB; no static import of any video library. The Tester updates the v0.1 assertion in `packages/starlight-docsandeye/test/build.test.ts` (currently three elements, 25 KB) to four elements, 30 KB.
2. **Facade markup.** `AEP/step-02-cap/index.html` contains the encoded contract for `vid-02-seat` (CHANGED_IN_FRAME): `preload="none"`, `poster` ending `vid-02-seat.webp`, AV1 `<source>` before H.264, both `data-height="720"`, `<track>` present (the fixture manifest gives it captions), the `<noscript>` link, `data-renditions="720,1080"`, and `<p class="docsi-banner" hidden>Recorded with Vial Cap v1.0.0, current is v2.0.0</p>`; the existing `<p class="docsi-note">` remains.
3. **STALE flow.** The fixture gains `vid-03-old` on `step-02-cap` (hero `top-stop@1.0.0`; top-stop is 1.3.0 → STALE; the changelog has one entry in (1.0.0, 1.3.0]): its `<details class="docsi-stale docsi-stale-video">` has the exact summary `A video exists for this step, but Top Stop has changed since it was filmed (v1.0.0 → v1.3.0)`, one changelog `<li>`, the `Watch the older video` button, the `<docsi-video>` inside `<div class="docsi-older" hidden>` with banner `Recorded with Top Stop v1.0.0, current is v1.3.0`, and the `<noscript>` link after the div; the renders and the text pane precede the details in document order.
4. **FRESH.** `vid-01-raft` on `step-01-raft` (hero `anode@1.0.0`, anode current 1.0.0) renders `<docsi-video data-status="FRESH">` in normal flow with no `docsi-banner` element and no details.
5. **Copy step and hosting.** Every output path in the fixture `build/media/manifest.json` appears under `dist/_docsandeye/media/`; `fixtures/site-hosted` (project config `hosting: {provider: url-prefix, base: https://media.example/}`) emits `src`/`poster`/`track` starting `https://media.example/build/media/` and its `dist/_docsandeye/media/` contains no `.webm`/`.mp4`/`.vtt` files.
6. **Client helpers.** Unit tests import `pickRendition` and `bannerText` from `src/elements/docsi-video.ts`: saveData → 720; effectiveType `3g` → 720; reducedData → 720; dpr 2 × width 700 with `[720, 1080]` → 1080; dpr 1 × width 1000 → 720; `[720]` only → 720; bannerText STALE names the first stale hero, CHANGED_IN_FRAME the first changed in_frame component, FRESH → null.
7. **No bytes before play.** No step page contains `preload="auto"`, `preload="metadata"`, `autoplay`, or `<link rel="preload" as="video">`. (The CLI budget walker already ignores `<source src>`; the existing `packages/cli/test/budget.test.ts` case stays as the regression guard — no new budget code is expected.)
8. **Strict by default, budget lines only.** `docsandeye check --dist` promotes only over-budget lines (`budget: <page> <kb> KB > <limit> KB`) to errors by default; informational warnings (`guard: not a git repository…`, `guard: …: no git history…`, `budget: … missing asset …`) stay warnings; `--no-strict` (an explicit boolean option in `bin.ts`'s `parseArgs`) restores the v0.1 behaviour; `--strict` is accepted as a no-op. The Tester updates `packages/cli/test/cli.test.ts` accordingly: the default-mode `--dist` tests whose fixture page is over budget now assert exit 1 and `errors: 1, warnings: 0` (the `toBeLessThanOrEqual(1)` hedges become exact), a `--no-strict` case asserts the old exit 0 / `warnings: 1`, and the "exits 0 when no errors" non-git temp-project case stays green unchanged.
9. **Degraded mode.** A fixture variant with no `build/media/manifest.json` (`fixtures/project-nomanifest` + `fixtures/site-nomanifest`) builds and renders `vid-02-seat` in the degraded contract: `data-renditions="source"`, one `<source>` pointing at `/_docsandeye/media/vid-02-seat.mp4`, `poster` at `/_docsandeye/media/vid-02-seat.jpg` (or whatever the authored poster's basename is), no `<track>`, the banner still present; no `data-docsi-video` attribute anywhere in `dist/`.
10. **Tokens and styles.** `--docsi-banner-bg` / `--docsi-banner-fg` are added to `docsandeye.css` with defaults (accent-low background, text colour); `.docsi-banner` is `position: sticky; top: 0` inside the `<docsi-video>` box; `packages/themes/**` is not edited.
11. **Package hygiene.** Root `npm run build` and `npx vitest run` green; no new runtime dependency in any `package.json`.

## Out of scope

- Encoding (task_007); geometry diff (v0.3); Wikimedia Commons or R2 upload tooling; analytics; autoplay; picture-in-picture; i18n of the fixed strings.
- Do not edit `README.md`, `TODO.md`, `CHANGELOG.md`, `.vs/tasks.json`, `.vs/progress.md`, `packages/themes/**`, `site/**`, `examples/**`, `packages/core/**`, `render/**`.

## Test location

`packages/starlight-docsandeye/test/` and `packages/cli/test/` (vitest). Generator scratch tests under `.vs/cycle-1/scratch-tests/`.

## Proposed budget

4 cycles.

## Model plan

- Generator: **fable** (Martin, 2026-09-05: Fable where it brings a clear benefit — this task spans the plugin's data layer, Astro components, a new custom element with client logic, fixtures for three site variants and a CLI behaviour change, the same cross-layer shape that justified Fable for task_003). Spec Critic: sonnet. Tester: sonnet (build-in-the-loop suite).
