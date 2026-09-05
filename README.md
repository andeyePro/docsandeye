# Docs&I

**Interactive video documentation for open-source hardware, that knows when its own videos have gone stale.**

Docs&I (`docsandeye` in code) builds assembly guides where every step has three things side by side:

- a **short video** of the step, self-hosted, low-carbon;
- the **full text**, complete on its own, never a caption;
- **drawings rendered automatically from the CAD files**, so a guide can be complete with no photography at all.

Each video declares which components are its **hero** (the subject of the shot) and which are merely **in frame**. When a hero component's design changes, the guide notices at build time and the video steps back: text and fresh renders become the primary content, and a reader who still wants the older video is first shown **what changed** (the changelog, and the old geometry beside the current one) before it plays, with a persistent "recorded with v1.3, current is v2.0" banner throughout. Maintainers get the inverse view: a dashboard of which videos need reshooting, and why.

Docs&I is a member of the andeye `<X>&I` family (alongside Time&I, Money&I, Task&I and Mail&I). It is being built first for the [electroPioreactor](https://github.com/amy-bo/electroPioreactor), an open aseptic electro-bioreactor, and is designed to sit beside an existing docs site rather than replace it.

## Prerequisites

- Node 22 or later (Astro 7 requires it) and npm.
- Python 3.11 or later for the render pipeline; it uses the standard library only.
- OpenSCAD 2024 or later (Manifold backend) to render `.scad` masters, and CadQuery for STEP masters. Both are optional external tools: the pipeline reports what is missing and can skip.
- ffmpeg 7 or later with `libsvtav1`, `libx264`, `libopus` and `libwebp` to encode video (v0.2). Optional: a project with no video, or one that has not been encoded yet, still builds.

## Status

v0.1 and the core of v0.2 are built and merged (4 to 5 September 2026): the schemas and staleness engine, the render pipeline, the command line, the Starlight plugin, the Pioreactor-style theme pack with the six-state theme cycle, a synthetic example guide and this project's own documentation site; then the video encoding pipeline (AV1 then H.264 behind ffmpeg), the `<docsi-video>` facade with the stale-video flow, and a byte budget that fails the build by default. No npm release yet. [Register interest](https://contact.andeye.com/?source=docs.andeye.com&subject=Docs%26I%20interest&message=Please%20email%20me%20when%20Docs%26I%20has%20a%20release.) and we will email you when there is one.

## Try it

Node 22 and Python 3.11 or later, then from a clone of this repository:

```
npm install
npm run build -w docsandeye-site
npm rebuild
npm run preview -w docsandeye-site
```

`npm rebuild` links the `docsandeye` binary into `node_modules/.bin` once the packages are built; the first `npm install` skips it because nothing is compiled yet. Open the address the last command prints. The example guide is under `/example/`; the theme button in the header cycles through the six theme states; `npx docsandeye check --project examples/synthetic-guide --dist site/dist` prints the per-page byte budget result and writes `build/carbon.json`.

## What is built so far

- `@docsandeye/core`: Zod schemas for components, steps, media and config; the project loader with a denylist; the staleness engine and `staleness.json`; the reshoot index; the render plan; the version-bump guard; the hosting-provider registry.
- `render/` (`docsandeye_render`): the Python pipeline, standard library only, with OpenSCAD and CadQuery drivers behind a seam, a version-keyed cache, a binary STL to GLB converter, and the v0.2 `encode` stage (ffmpeg behind a seam: AV1 then H.264 at 720p and 1080p, WebP posters, captions).
- `docsandeye` CLI: `init`, `render`, `encode`, `diff` (restore each stale hero's old geometry from git at the recorded version, converting a restored STL to GLB), `check` (validation, git version-bump guard, 150 KB byte budget that fails the build by default, CO2.js carbon figure).
- `starlight-docsandeye`: guide and step routes, `<docsi-step>`, `<docsi-model>`, `<docsi-lightbox>`, `<docsi-video>` and `<docsi-diff>` custom elements that read without JavaScript, the stale-video flow with its persistent recorded-with banner, the old-and-new geometry pane inside the stale panel, sidebar badges, the maintainer reshoot dashboard.
- `@docsandeye/themes`: the `pioreactor` pack from published token values, no font files, and the `<docsi-theme>` control.
- `examples/synthetic-guide` and `site/`: a bench-lamp example processed end to end, and the documentation site built with the plugin.

## How it works

- **Astro + Starlight.** Docs&I ships as a Starlight plugin (`starlight-docsandeye`) that drops into any existing Starlight site, plus a thin `docsandeye` CLI that scaffolds a site for hardware projects that have none. Search, sidebar, dark mode and i18n come from Starlight; the step, video, 3D-viewer and diff elements come from Docs&I as framework-agnostic custom elements that also embed in other site generators.
- **Content is plain files in your hardware repo.** Components, steps and videos are YAML and Markdown under `docs/`, readable on GitHub, on a Radicle mirror, or offline, with no build step. Vocabulary is kept compatible with BuildUp (GitBuilding) part links and the Open Know-How manifest so content can be exported later.
- **Components carry an explicit `design_version`.** Bumped by the designer, checked in CI against the git history of the source files, so a changed part cannot slip through unversioned. Every render is cached by component version, so a build where nothing changed renders nothing.
- **Renders from source.** OpenSCAD for `.scad`, CadQuery for STEP: shaded stills, exploded and annotated views, SVG line-art and GLB for an in-page 3D viewer. Photographs are allowed too, with the same hero/in-frame tagging, for the parts CAD cannot show.
- **Video without the byte tax.** Clips are encoded AV1-first with an H.264 fallback and embedded behind a poster with `preload="none"`, so a step page transfers zero video bytes until the reader presses play, and no third-party JavaScript ever. No YouTube iframes, no HLS/DASH for sub-90-second clips.
- **Carbon is measured, not asserted.** Each step page has a byte budget for its initial load, enforced in CI, and the estimated gCO2e per page (CO2.js, Sustainable Web Design model) is published on the page.
- **Accessibility and text-first by design.** The text path is already the fallback for a stale video, so the guide must be complete with video disabled: captions, poster frames, real headings, no information carried only in a clip.

## Roadmap

| Phase | Scope |
|---|---|
| **v0.1** | Component, step and media schemas; render CLI for `.scad` and STEP; staleness JSON and the reshoot dashboard; text, renders and 3D viewer per step; a Pioreactor-style theme pack built from published colour values (it names Roboto and Source Code Pro but ships no font files, so pages stay light) |
| **v0.2** | Video manifests with hero/in-frame tagging; AV1 + H.264 encoding; posters and WebVTT captions; the full stale-video experience |
| **v0.3** | Shipped: `docsandeye diff` restores a stale shot's old geometry from git at the recorded version and the stale panel shows it side by side with the current model (`<docsi-diff>`). Deferred: the red/green/grey overlay of removed, added and unchanged geometry; re-rendering the restored CAD sources rather than restoring committed derived files; diffs for `CHANGED_IN_FRAME` pins |
| Later | BuildUp and Open Know-How export, PDF output, per-step reader comments, QR codes on printed parts, Whisper transcription for shoot-first workflows |

## Beyond the free tool

The open-source engine is complete on its own: bring your own hosting and your own camera. Two optional services are planned around it:

- **Docs&I Plus: zero-carbon video hosting.** Managed hosting for your guide's clips on renewable-powered infrastructure with the AV1 pipeline, renditions and permanence handled for you, so a growing library of videos (including the superseded ones your stale-video flow still needs) never becomes a bandwidth bill or a carbon liability.
- **Docs&I Pro: video production.** andeye Ltd shoots, edits and tags the step videos for your hardware project, delivered straight into your repo in the Docs&I format with hero/in-frame metadata already declared, so staleness tracking works from day one.

Interested in either? [Tell us](https://contact.andeye.com/?source=docs.andeye.com&subject=Docs%26I%20Plus%20%2F%20Pro&message=I%27m%20interested%20in%20Docs%26I%20hosting%20or%20video%20production%20for%20my%20project.).

## Licence and contributing

Docs&I is released under the **GNU AGPL-3.0** with an additional permission under section 7: **sites and assets generated by Docs&I are not covered works**, so the guides you publish carry no obligations from this licence. See [LICENSE](LICENSE). Contributions are accepted under the andeye Contributor Licence Agreement ([CLA.md](CLA.md); you keep your copyright, signing is one comment on your first pull request). See [CONTRIBUTING.md](CONTRIBUTING.md) and [CONTRIBUTORS.md](CONTRIBUTORS.md).

Third-party notices: Astro and Starlight are MIT; OpenSCAD, CadQuery and their dependencies are used as external tools under their own licences.

## Links

- Site: [docs.andeye.com](https://docs.andeye.com) (coming)
- Contact: [contact.andeye.com](https://contact.andeye.com/?source=docs.andeye.com)
- First project: [electroPioreactor](https://github.com/amy-bo/electroPioreactor)
