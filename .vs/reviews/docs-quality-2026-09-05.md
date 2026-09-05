# Docs&I documentation review — 2026-09-05

Read as a first-time hardware author. Build succeeded (`npm run build`, 16
pages, one expected warning). CLI usage/flags/exit-codes and the component,
step and media schemas match the source exactly, and cross-link anchors all
resolve in `site/dist`. The one thing that does not survive contact with a
terminal is the tutorial's own npm-install step: followed literally from a
clean clone, `getting-started.md` 404s before step 3. Config-file fields are
scattered across four pages with no single reference.

## Findings

### getting-started.md

1. [HIGH] "1. Init" / "3. Render" — Following the page literally breaks the
   tutorial. `npx docsandeye init ../bench-lamp ...` then `cd ../bench-lamp`
   moves the reader out of the monorepo; the scaffolded `package.json` pins
   `"docsandeye": "^0.1.0"` and `"starlight-docsandeye": "^0.1.0"` from the
   npm registry, which do not exist yet (Status: "No npm release yet").
   Verified live: `npm install` there gives `npm error 404 ... 'docsandeye@^0.1.0' is not in this registry`,
   and `npx docsandeye render` from that directory fails the same way before
   step 7 is even reached. Fix: add a line after step 1 telling the reader to
   stay in the repo and run all `docsandeye` commands via `npx docsandeye
   --project ../bench-lamp ...` from the repo root (as README's "Try it"
   already does via workspace linking), or ship/point at a `file:` /
   `npm link` recipe until a real npm release exists.

2. [LOW] "5. Diff" — says diff runs "for every media that has gone stale",
   but `cli.md` and `staleness.md` both say only `STALE` (hero-pin) media is
   planned; `CHANGED_IN_FRAME` pins are explicitly excluded. Fix: change the
   sentence to "for every STALE media" to match the other two pages.

### README.md

3. [MEDIUM] "Prerequisites" — lists Node, Python and OpenSCAD/CadQuery but
   omits ffmpeg, even though the same README's own "Status" and "What is
   built so far" sections say the v0.2 ffmpeg encode pipeline is already
   merged, and `getting-started.md`'s Prerequisites correctly lists
   "ffmpeg 7 or later with libsvtav1, libx264, libopus and libwebp". Fix: add
   the same ffmpeg line to README's Prerequisites list.

4. [MEDIUM] "Try it" (the `docsandeye check --project examples/synthetic-guide
   --dist site/dist` sentence) — every other page (`cli.md`,
   `getting-started.md`) prefixes commands with `npx`; this one does not,
   and typing it as written fails with "command not found" unless the reader
   already has `node_modules/.bin` on `PATH`. Fix: write it as
   `npx docsandeye check --project examples/synthetic-guide --dist site/dist`.

### authoring/media.md

5. [MEDIUM] "Video" example — the manifest example (`vid-02-fit-the-arm`,
   `file: assets/video/vid-02-fit-the-arm.mp4`) is the exact file that, when
   built, prints `missing render/media file, not copied:
   .../vid-02-fit-the-arm.mp4` (reproduced in this review's build log). No
   page on the docs site (`media.md`, `getting-started.md`, `cli.md`)
   explains this warning; only `examples/synthetic-guide/README.md` (not
   published on the site) says video files are deliberately never committed.
   Fix: add a sentence under "Video encoding" or "Playback" noting that an
   authored `file` with no committed video is expected until a real clip is
   added, and that the build only warns, it does not fail.

### cli.md

6. [MEDIUM] "Environment" table — `DOCSANDEYE_RENDER_PYTHONPATH` is
   documented only as defaulting to "the repository's `render/`". Once a
   project is scaffolded outside the monorepo (the exact workflow
   `getting-started.md` walks through), there is no `render/` next to it, and
   `packages/cli/package.json`'s `"files"` allowlist (`dist`, `templates`)
   does not ship the Python package either, so `render`/`encode`/`diff` have
   no working default there. Fix: add a line saying standalone projects must
   set this variable themselves, and where the `docsandeye_render` package
   comes from once published.

### No config-file reference page

7. [HIGH] `docsandeye.config.yaml` fields are split across four unrelated
   pages — `theme` in `themes.md`, `hosting`/`denylist` in `media.md`,
   `byte_budget_kb` in `carbon.md`, `guide` cross-reference in `steps.md` —
   and nowhere is the file shown whole. `guides[].base` (required, must
   start with `/`, sets the guide's URL prefix per `GuideSchema` in
   `packages/core/src/schemas.ts`) is never mentioned on the site at all,
   even though a reader copying `examples/synthetic-guide`'s config will see
   it and have no page to check it against. Fix: add a short "Project
   configuration" page (or a section on `getting-started.md`) with one full
   annotated `docsandeye.config.yaml` covering `theme`, `guides` (incl.
   `base`), `denylist`, `hosting` and `byte_budget_kb`, and link it from
   `getting-started.md` step 1.

## What works well (keep)

- `cli.md` matches `packages/cli/src/bin.ts` exactly: every flag, default,
  exit code and problem code checks out against the source.
- The component/step/media field tables in `authoring/*.md` match
  `packages/core/src/schemas.ts` field-for-field, including required/default
  columns.
- All internal cross-links and anchors (`/staleness/#old-and-new-geometry`,
  `/cli/#diff`, etc.) resolve correctly in the built `site/dist`.
- `staleness.md`'s FRESH / CHANGED_IN_FRAME / STALE table is clear and the
  worked example matches the actual example guide's data.
- The example project (`examples/synthetic-guide`) faithfully exercises the
  documented schemas — every field shown in the authoring docs appears in a
  real file in the example.
