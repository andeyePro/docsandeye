# TODO

Open backlog for Docs&I (`docsandeye`). Done work goes to CHANGELOG.md, never here.
Design inputs: the research briefing at `Martin/Docs&I.md` (local, gitignored) and the
decision record in brain2 `andeye/Docs&I-Q&A-archive.md` (local). Both are on the
maintainer's machine only; the public-facing summary is README.md.

## Open

### v0.1 — data, renders, staleness, no video

- [ ] **First consumer: electroPioreactor AEP0.2, remaining** — live at docs.electropioreactor.org since 2026-09-29 (Cloudflare Pages Direct Upload with wrangler from `site/`, production branch AEP02; contact address confirmed, videos 1-3 and 6-8 in, checks rewritten as multiple choice). Still open: the kit quantities LabCrafter must confirm (brain2 AMYBO/LabCrafter-questions-for-Gerrit), the software setup video Martin is to record (fromClaude 4), and after launch: merge AEP02 into main, set the Pages production branch back to main and deploy with `--branch main`.

- [ ] **Footage tools on real footage, remaining**: `tools/footage` ran on the AEP0.2 shoot on Laura's MacBook Pro on 2026-09-25 (sessions, transcripts, cut sheet in its shared footage-prep folder), and the chapter lists for videos 1-3 and 6-8 came from whisper runs there. Still unconfirmed: that Final Cut imports the FCPXML multicam.

- [ ] **Deploy**: docs.andeye.com Pages project (root `site`, `npm run build`, `dist`) is Martin's dashboard step (fromClaude 11e). The AEP guide's own project (docs.electroPioreactor.org) is done.

### v0.2 — video

- [ ] **Storage, remaining**: the Wikimedia Commons path (needs Martin's licence decision and a Commons scope check) and an Internet Archive mirror recipe. (`local`, `url-prefix` and `r2` providers are shipped and documented.)
- [ ] **v0.2 real-toolchain check** (Mac): run `docsandeye encode` with real ffmpeg on one clip and `docsandeye render` with real OpenSCAD on the Vial Cap; fix any argv drift.

### v0.3 — geometry diff

- [ ] **Geometry diff, remaining**: the red (removed) / green (added) / grey (unchanged) overlay needs a mesh boolean or a voxel/sample comparison the container cannot run today (no trimesh/numpy); re-rendering restored `.scad`/`.step` sources at the recorded version through the pipeline; CHANGED_IN_FRAME diffs. (Slice 1 shipped: `docsandeye diff` restores committed derived geometry from git, converts to GLB, and `<docsi-diff>` shows old and new side by side in the stale details.)
- [ ] `trimesh` normalised geometry hash as the false-positive gate on the version-bump guard.

### Later

- [ ] Export follow-ups: a GitBuilding part library file for the BOM (its YAML schema needs checking against gitbuilding.io online), validation of `okh.yml` with `okh-tool`, copying posters, captions and derived CAD files into the export tree, and a real `gitbuilding build` on the exported tree (needs the Python package on a Mac). Shipped: BuildUp step files, index with BOM and `{step}` links, `buildconf.yaml`, `okh.yml`, media links and local media copy.
- [ ] PDF output; per-step reader comments; QR codes on printed parts.
- [ ] Dimensioned technical drawings (FreeCAD TechDraw headless is broken upstream, #5710).
- [ ] Approach GitBuilding/GOSH after v0.1 exists.
- [ ] Whisper transcription for shoot-first workflows (deliberately last).
