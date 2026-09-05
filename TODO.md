# TODO

Open backlog for Docs&I (`docsandeye`). Done work goes to CHANGELOG.md, never here.
Design inputs: the research briefing at `Martin/Docs&I.md` (local, gitignored) and the
decision record in brain2 `andeye/Docs&I-Q&A-archive.md` (local). Both are on the
maintainer's machine only; the public-facing summary is README.md.

## Open

### v0.1 — data, renders, staleness, no video

- [ ] **First consumer: electroPioreactor AEP0.2** — content landed on the AEP02 branch of Martin's clone (commit 80780ae: 69 components, 12 steps, shoot list, stubs); Reviewer pass with 4 minor notes; awaiting Martin's own review (Docs&I-fromClaude item 10) and the docs.electroPioreactor.org/AEP deployment.

- [ ] **CLI follow-up**: switch `check` from its `git merge-base --is-ancestor` workaround to core's new `versionAfterSource` fact flag; switch `site/src/content.config.ts` to the plugin's `stepFrontmatterExtension`; the themes head script could be injected by the plugin; hand-exported jobs use `outputs[0]` for both render and viewer.
- [ ] **Deploy**: docs.andeye.com Pages project (root `site`, `npm run build`, `dist`) is Martin's dashboard step; the AEP guide needs its own Pages project on the electroPioreactor repo (docs.electroPioreactor.org, business Cloudflare account).

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
