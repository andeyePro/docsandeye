---
title: Getting started
description: Scaffold a Docs&I project, author content, render drawings, encode video, restore old geometry, export it, check it and build the site.
---

Docs&I is pre-alpha and not on npm yet. Work from a clone of the repository.

## Prerequisites

- Node 22 or later and npm.
- Python 3.11 or later. The render pipeline uses the standard library only.
- OpenSCAD 2024 or later to render `.scad` masters, and CadQuery to render STEP masters. Both are optional. The pipeline reports what is missing and can skip.
- ffmpeg 7 or later with `libsvtav1`, `libx264`, `libopus` and `libwebp` to encode video. Optional: a project with no video, or one that has not been encoded yet, still builds.

## Install the tools

```sh
git clone https://github.com/amy-bo/docsandeye.git
cd docsandeye
npm install
npm run build
npm rebuild
```

`npm run build` compiles every workspace package. `npm rebuild` then links the `docsandeye` binary into `node_modules/.bin`, which the first `npm install` skipped because `packages/cli/dist/` did not exist yet; a second `npm install` does the same job. After that, `npx docsandeye` runs the CLI from the repository root.

Stay in the repository root for the rest of this page. Docs&I is not on npm yet, so a scaffolded project cannot install `docsandeye` and `starlight-docsandeye` from the registry; `init` detects that it is running from a clone and writes `file:` specifiers pointing back at this checkout instead. Every command below is run from the repository root and names the project with `--project`.

## 1. Init

Create a project next to the repository. The guide id is kebab-case and becomes the URL prefix.

```sh
npx docsandeye init ../bench-lamp --guide lamp --title "Bench lamp"
```

`init` writes `docsandeye.config.yaml`, a Starlight site (`astro.config.mjs`, `src/content.config.ts`, `package.json`) and one example component and step under `docs/`. It refuses to overwrite an existing project unless you pass `--force`. Every field of the config file is on [Project configuration](/authoring/config/).

Because it ran from a clone, the generated `package.json` depends on `"docsandeye": "file:../docsandeye/packages/cli"` and `"starlight-docsandeye": "file:../docsandeye/packages/starlight-docsandeye"`, and its README says so. Outside the monorepo `init` writes registry ranges, which will work once there is a release.

## 2. Author

Content lives under `docs/` as plain files:

- `docs/components/` has one YAML file per part. See [Components](/authoring/components/).
- `docs/steps/` has one Markdown file per step. The frontmatter lists parts, tools, renders and media. See [Steps](/authoring/steps/).
- `docs/media/` has one YAML manifest per photo or video, pinning the component versions it shows. See [Media](/authoring/media/).

The file name must match the `id` inside it. Steps belong to a guide named in `docsandeye.config.yaml`; a step with no `guide` field belongs to the first guide.

## 3. Render

```sh
npx docsandeye render --project ../bench-lamp
```

The CLI writes `build/render-plan.json` from the steps' `renders` and `viewer` entries and hands it to the Python pipeline. Outputs land in `build/render/` with `build/render/manifest.json` beside them. Jobs are cached by component version, so a build where nothing changed renders nothing. Components with `master_format: none` or `f3z` are hand-exported: the pipeline records their `derived_files` and renders nothing for them.

Renders are produced locally and committed. Nothing is rendered in CI.

## 4. Encode

```sh
npx docsandeye encode --project ../bench-lamp
```

The CLI writes `build/media-plan.json` from the `type: video` manifests and hands it to the same Python pipeline. Each clip becomes an AV1 WebM and an H.264 MP4 at 720 and 1080, a WebP poster and a copy of the captions, in `build/media/` with `build/media/manifest.json` beside them. Jobs are cached on the source file, so re-running encodes nothing new.

Skip this step and the site still builds: a video with no manifest entry falls back to its authored poster and the original file. Run it and the step page serves the encoded renditions instead. See [Media](/authoring/media/) for what the reader gets.

Encoded video is produced locally and committed, like renders. Nothing is encoded in CI.

## 5. Diff (optional)

```sh
npx docsandeye diff --project ../bench-lamp
```

For every `STALE` media — a pin on a hero component whose design version has moved on; `CHANGED_IN_FRAME` pins are excluded — `diff` restores the changed hero component's derived geometry as it was committed at the recorded version and writes it to `build/render/old/`, with `build/render/old/manifest.json` beside it. An `.stl` is converted to GLB on the way. The stale panel on the step page then shows that old model beside the current one. See [Old and new geometry](/staleness/#old-and-new-geometry).

This step is optional and it needs git history. Outside a git repository, or where the old version was never committed with its geometry, every job is skipped, the command still exits 0, and the site builds without the pane. Restored geometry is produced locally and committed, like renders and encoded video.

## 6. Export (optional)

```sh
npx docsandeye export --project ../bench-lamp
```

Writes BuildUp-flavoured Markdown and an Open Know-How manifest under `build/export/`: `buildup/index.md` and one `buildup/<step-id>.md` per step, plus `okh/okh.yml`. Both are computed purely from the loaded model, so this step needs nothing else to have run first. See [`export`](/cli/#export).

This step is optional: the site builds and the guide reads the same whether or not you run it. It is for handing the guide to something that reads BuildUp Markdown or an Open Know-How manifest, such as GitBuilding.

## 7. Check

```sh
npx docsandeye check --project ../bench-lamp
```

`check` validates every file, then runs the version-bump guard: a component whose CAD source files changed in git without a `design_version` bump is an error. Exit code 0 means clean.

## 8. Build

```sh
npm install --prefix ../bench-lamp
npm run build --prefix ../bench-lamp
npx docsandeye check --project ../bench-lamp --dist ../bench-lamp/dist
```

`npm install` in the project links this checkout through the `file:` specifiers from step 1, so it needs no npm release. `npm run build` runs `astro build`. The plugin adds one page per guide and per step, copies renders, media and encoded video into `dist/_docsandeye/`, and prints a summary. The second `check` measures the initial-load bytes of every step page against `byte_budget_kb`, estimates CO2e and writes `build/carbon.json`. A page over budget is an error; see [Carbon](/carbon/). Commit that file; the next build prints the figure on each step page.

## Maintainer builds

Two environment variables change a build:

- `DOCSANDEYE_MAINTAINER=1` adds the `/reshoot/` dashboard listing which media need reshooting and why.
- `DOCSANDEYE_BUILD_DATE=2026-09-04` fixes the date used for the "updated" sidebar badge. Default is today.

## Next

The [example guide](/example/) in this site is a complete project: `examples/synthetic-guide` in the repository. Copy it as a starting point.
