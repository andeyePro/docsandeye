# TODO

Open backlog for Docs&I (`docsandeye`). Done work goes to CHANGELOG.md, never here.
Design inputs: the research briefing at `Martin/Docs&I.md` (local, gitignored) and the
decision record in brain2 `andeye/Docs&I-Q&A-archive.md` (local). Both are on the
maintainer's machine only; the public-facing summary is README.md.

## Open

### v0.1 — data, renders, staleness, no video

- [ ] **First consumer: electroPioreactor AEP0.2** — content landed on the AEP02 branch of Martin's clone (commit 80780ae: 69 components, 12 steps, shoot list, stubs); Reviewer pass with 4 minor notes; awaiting Martin's own review (Docs&I-fromClaude item 10) and the docs.electroPioreactor.org/AEP deployment.
- [ ] **Plus/Pro seam** (in task_001: the hosting-provider registry in `packages/core/src/hosting.ts`): a hosting-provider abstraction for video assets (local path or bucket URL)
      so a managed zero-carbon hosting tier can plug in later without schema changes. No paid code.

- [ ] **Flaky CLI tests under the full parallel run**: `packages/cli/test/cli.test.ts` passes alone (54/54) but 1–3 cases (AC2 exit-65, AC6 non-git skip, AC7 hrefs/carbon) fail intermittently when the whole workspace suite runs alongside the plugin's `astro build` tests; passes on re-run. Likely a shared temp path, `process.chdir`, or a timeout under load — isolate per-test temp dirs and raise the exec timeout.
- [ ] **Themes follow-up**: `packages/themes/src/state.ts` (cycle order, parse/format, storage round-trip) has no unit tests; add a vitest file. Also the head script could be injected by the plugin instead of the site config, and hand-exported jobs use `outputs[0]` for both render and viewer.
- [ ] **Deploy**: docs.andeye.com Pages project (root `site`, `npm run build`, `dist`) is Martin's dashboard step; the AEP guide needs its own Pages project on the electroPioreactor repo (docs.electroPioreactor.org, business Cloudflare account).
- [ ] **Plugin follow-up**: `docsSchema({ extend: stepFrontmatterSchema })` makes the step fields required on every docs entry; export a partial extension (or make the step fields optional in the extension) so ordinary documentation pages validate — the dogfood site uses `.partial()` meanwhile.
- [ ] **Core follow-ups from downstream tasks**: `loadProject` should ignore `README.md` inside `docs/steps/` (task_006 could not place its steps README there); `checkVersionBumps` should treat a version commit that is a descendant of the source commit as satisfied (the CLI currently clears these with `git merge-base --is-ancestor`).

### v0.2 — video

- [ ] Video and photo manifests with hero/in-frame tagging; AV1 (SVT-AV1) + H.264 encodes at 720p
      and 1080p; WebP/AVIF posters; WebVTT captions from the scripted narration.
- [ ] `<docsi-video>`: `preload="none"` poster facade, AV1-first source order, client-side rendition
      pick (saveData / effectiveType / prefers-reduced-data), persistent "recorded with vX, current
      vY" banner.
- [ ] Stale-video UX: banner → "Watch the older video" → what-changed panel (changelog) → play.
      CHANGED_IN_FRAME stays primary with a one-line note.
- [ ] Storage: Cloudflare R2 + Pages (zero egress); Wikimedia Commons path if clips are CC BY-SA
      and Commons accepts the scope; Internet Archive mirror.
- [ ] Carbon gate becomes a hard fail.

### v0.3 — geometry diff

- [ ] Old geometry restored with `git show` at the recorded version, re-rendered through the same
      cache, overlaid red (removed) / green (added) / grey (unchanged) in `<docsi-diff>`.
- [ ] `trimesh` normalised geometry hash as the false-positive gate on the version-bump guard.

### Later

- [ ] BuildUp and OKH exporters; PDF output; per-step reader comments; QR codes on printed parts.
- [ ] Dimensioned technical drawings (FreeCAD TechDraw headless is broken upstream, #5710).
- [ ] Approach GitBuilding/GOSH after v0.1 exists.
- [ ] Whisper transcription for shoot-first workflows (deliberately last).
