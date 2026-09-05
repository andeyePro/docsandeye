# TODO

Open backlog for Docs&I (`docsandeye`). Done work goes to CHANGELOG.md, never here.
Design inputs: the research briefing at `Martin/Docs&I.md` (local, gitignored) and the
decision record in brain2 `andeye/Docs&I-Q&A-archive.md` (local). Both are on the
maintainer's machine only; the public-facing summary is README.md.

## Open

### v0.1 — data, renders, staleness, no video

- [ ] **First consumer: electroPioreactor AEP0.2** — content landed on the AEP02 branch of Martin's clone (commit 80780ae: 69 components, 12 steps, shoot list, stubs); Reviewer pass with 4 minor notes; awaiting Martin's own review (Docs&I-fromClaude item 10) and the docs.electroPioreactor.org/AEP deployment.

- [ ] **Deploy**: docs.andeye.com Pages project (root `site`, `npm run build`, `dist`) is Martin's dashboard step; the AEP guide needs its own Pages project on the electroPioreactor repo (docs.electroPioreactor.org, business Cloudflare account).

### v0.2 — video

- [ ] **Storage, remaining**: the Wikimedia Commons path (needs Martin's licence decision and a Commons scope check) and an Internet Archive mirror recipe. (`local`, `url-prefix` and `r2` providers are shipped and documented.)
- [ ] **v0.2 real-toolchain check** (Mac): run `docsandeye encode` with real ffmpeg on one clip and `docsandeye render` with real OpenSCAD on the Vial Cap; fix any argv drift.

### v0.3 — geometry diff

- [ ] **Geometry diff, remaining**: the red (removed) / green (added) / grey (unchanged) overlay needs a mesh boolean or a voxel/sample comparison the container cannot run today (no trimesh/numpy); re-rendering restored `.scad`/`.step` sources at the recorded version through the pipeline; CHANGED_IN_FRAME diffs. (Slice 1 shipped: `docsandeye diff` restores committed derived geometry from git, converts to GLB, and `<docsi-diff>` shows old and new side by side in the stale details.)
- [ ] `trimesh` normalised geometry hash as the false-positive gate on the version-bump guard.

### Later

- [ ] Export follow-ups: GitBuilding `buildconf.yaml`, validation with `okh-tool`, copying media and derived files into the export tree (the `docsandeye export` BuildUp + OKH core shipped in task_017).
- [ ] PDF output; per-step reader comments; QR codes on printed parts.
- [ ] Dimensioned technical drawings (FreeCAD TechDraw headless is broken upstream, #5710).
- [ ] Approach GitBuilding/GOSH after v0.1 exists.
- [ ] Whisper transcription for shoot-first workflows (deliberately last).
