# TODO

Open backlog for Docs&I (`docsandeye`). Done work goes to CHANGELOG.md, never here.
Design inputs: the research briefing at `Martin/Docs&I.md` (local, gitignored) and the
decision record in brain2 `andeye/Docs&I-Q&A-archive.md` (local). Both are on the
maintainer's machine only; the public-facing summary is README.md.

## Open

### v0.1 — data, renders, staleness, no video

- [ ] **Spec v0.1** (spec-first): content schemas for components, steps, videos and photos
      (component@version pins, hero/in-frame, BuildUp/OKH-compatible field names, no exporters);
      staleness algorithm and `staleness.json`; the `/reshoot` dashboard; error handling for
      missing versions, unrenderable masters (`.f3z`) and denylisted paths.
- [ ] **`starlight-docsandeye` plugin**: extends `docsSchema()` with the step fields, registers the
      components and videos collections, ships `<docsi-step>` and `<docsi-model>` as vanilla custom
      elements with static-HTML fallback, sidebar badges derived from staleness data.
- [ ] **`docsandeye` CLI**: `init` scaffolds a Starlight site with the plugin; `render` runs the
      Python render pipeline; `check` runs the version-bump guard and the byte budget.
- [ ] **Render pipeline** (Python): OpenSCAD CLI for `.scad` (Manifold backend, BOSL2 on the include
      path), CadQuery/OCP for STEP (PNG, SVG line-art, exploded/annotated, GLB); outputs committed,
      cache keyed by `<component>@<design_version>--<render-id>--<params-hash>`; `.f3z` flagged as
      hand-exported. Runs locally, never in GitHub Actions.
- [ ] **Version-bump guard**: source file git history moved and `design_version` did not → fail.
- [ ] **Theme packs**: `pioreactor` (default; re-implemented from published token values, no copied
      CSS or JS) and stock Starlight. Theme control cycles Pioreactor inherit → Pioreactor light →
      Pioreactor dark → Starlight inherit → Starlight dark → Starlight light, with the logo variants
      (mark over half-filled circle / sun / moon); fall back to a plain picker if the cycling logo is
      expensive.
- [ ] **Carbon gate**: poster-only initial load of a step page ≤ 150 KB, checked by `docsandeye check`;
      CO2.js (Sustainable Web Design v4) gCO2e figure rendered on every page. Warn in v0.1.
- [ ] **Dogfood**: this repo's own docs site built with the plugin; one synthetic example project
      under `examples/`.
- [ ] **First consumer: electroPioreactor AEP0.2** — content under `docs/` on the `AEP02` branch of
      the shared mount at `/repos/electroPioreactor`, converted from the existing assembly README;
      published at docs.electroPioreactor.org/AEP. Design for a sibling `/MEP` guide that shares
      most components and steps. Denylist `AEP-Plugin/pi02-setup-notes.md` from ingestion.
- [ ] **Plus/Pro seam**: a hosting-provider abstraction for video assets (local path or bucket URL)
      so a managed zero-carbon hosting tier can plug in later without schema changes. No paid code.
- [ ] **CHANGELOG.md** created on the first closed task.

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
