---
title: Getting started
description: Scaffold a Docs&I project, author content, render drawings, encode video, restore old geometry, check it and build the site.
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
```

`npm run build` compiles every workspace package. After it, `npx docsandeye` runs the CLI from the repository root.

## 1. Init

Create a project next to the repository. The guide id is kebab-case and becomes the URL prefix.

```sh
npx docsandeye init ../bench-lamp --guide lamp --title "Bench lamp"
cd ../bench-lamp
```

`init` writes `docsandeye.config.yaml`, a Starlight site (`astro.config.mjs`, `src/content.config.ts`, `package.json`) and one example component and step under `docs/`. It refuses to overwrite an existing project unless you pass `--force`.

## 2. Author

Content lives under `docs/` as plain files:

- `docs/components/` has one YAML file per part. See [Components](/authoring/components/).
- `docs/steps/` has one Markdown file per step. The frontmatter lists parts, tools, renders and media. See [Steps](/authoring/steps/).
- `docs/media/` has one YAML manifest per photo or video, pinning the component versions it shows. See [Media](/authoring/media/).

The file name must match the `id` inside it. Steps belong to a guide named in `docsandeye.config.yaml`; a step with no `guide` field belongs to the first guide.

## 3. Render

```sh
npx docsandeye render
```

The CLI writes `build/render-plan.json` from the steps' `renders` and `viewer` entries and hands it to the Python pipeline. Outputs land in `build/render/` with `build/render/manifest.json` beside them. Jobs are cached by component version, so a build where nothing changed renders nothing. Components with `master_format: none` or `f3z` are hand-exported: the pipeline records their `derived_files` and renders nothing for them.

Renders are produced locally and committed. Nothing is rendered in CI.

## 4. Encode

```sh
npx docsandeye encode
```

The CLI writes `build/media-plan.json` from the `type: video` manifests and hands it to the same Python pipeline. Each clip becomes an AV1 WebM and an H.264 MP4 at 720 and 1080, a WebP poster and a copy of the captions, in `build/media/` with `build/media/manifest.json` beside them. Jobs are cached on the source file, so re-running encodes nothing new.

Skip this step and the site still builds: a video with no manifest entry falls back to its authored poster and the original file. Run it and the step page serves the encoded renditions instead. See [Media](/authoring/media/) for what the reader gets.

Encoded video is produced locally and committed, like renders. Nothing is encoded in CI.

## 5. Diff (optional)

```sh
npx docsandeye diff
```

For every media that has gone stale, `diff` restores the changed hero component's derived geometry as it was committed at the recorded version and writes it to `build/render/old/`, with `build/render/old/manifest.json` beside it. An `.stl` is converted to GLB on the way. The stale panel on the step page then shows that old model beside the current one. See [Old and new geometry](/staleness/#old-and-new-geometry).

This step is optional and it needs git history. Outside a git repository, or where the old version was never committed with its geometry, every job is skipped, the command still exits 0, and the site builds without the pane. Restored geometry is produced locally and committed, like renders and encoded video.

## 6. Check

```sh
npx docsandeye check
```

`check` validates every file, then runs the version-bump guard: a component whose CAD source files changed in git without a `design_version` bump is an error. Exit code 0 means clean.

## 7. Build

```sh
npm install
npm run build
npx docsandeye check --dist dist
```

`npm run build` runs `astro build`. The plugin adds one page per guide and per step, copies renders, media and encoded video into `dist/_docsandeye/`, and prints a summary. The second `check` measures the initial-load bytes of every step page against `byte_budget_kb`, estimates CO2e and writes `build/carbon.json`. A page over budget is an error; see [Carbon](/carbon/). Commit that file; the next build prints the figure on each step page.

## Maintainer builds

Two environment variables change a build:

- `DOCSANDEYE_MAINTAINER=1` adds the `/reshoot/` dashboard listing which media need reshooting and why.
- `DOCSANDEYE_BUILD_DATE=2026-09-04` fixes the date used for the "updated" sidebar badge. Default is today.

## Next

The [example guide](/example/) in this site is a complete project: `examples/synthetic-guide` in the repository. Copy it as a starting point.
