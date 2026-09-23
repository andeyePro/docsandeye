# Synthetic guide: a bench lamp

A small made-up hardware project that exercises the whole Docs&I engine without CAD tools. It is the example guide on docs.andeye.com, served under `/example/`.

- Three printed parts (`lamp-base`, `lamp-arm`, `lamp-shade`) and four off-the-shelf parts (`m3-screw`, `led-module`, `hex-key`, `dimmer-module`).
- Five steps; the fifth (`step-05-fit-the-dimmer`) appears only for readers fitting the optional dimmer.
- Two photos and one video manifest. The video shows as its poster; playback is the next release. The video file itself is not committed (the repository never carries rendered video), so the site build logs one "missing render/media file" warning for it.
- Every printed part is hand-exported (`master_format: none` with `derived_files`), so `docsandeye render` completes with `hand-exported 3` and renders nothing.

The guide is reader-interactive (see the site's `authoring/interactive` page): the guide page asks how many lamps, whether a dimmer is fitted and where the parts came from. Step 1 has the setup form and the "count what you received" checklist (per-lamp parts multiplied by the lamp count, a per-kit hex key, a dimmer only with the dimmer, everything moved to "source these yourself" for a self-sourced build, and a missing-parts email to the made-up kit shop). Steps 1 and 3 have paragraphs shown only for some setups, step 3 a part only with the dimmer and yes/no checks, and step 5 a YouTube clip behind a click-to-load facade. The YouTube id and the `example.invalid` contacts are placeholders.

The lamp base was shot at `1.0.0` and is now `1.1.0`, so the photo in step 1 is stale and the photo in step 3 carries a changed-in-frame note.

## Assets

`assets/renders/*.svg` are hand-drawn line art. `assets/photo/*.png` and `assets/video/*.png` are flat illustrations, about 1.5 KB each. `assets/renders/lamp-shade.stl` is a hand-written 40 mm cube; `lamp-shade.glb` was made from it with the render pipeline's converter:

```sh
PYTHONPATH=render python3 -c 'from docsandeye_render.glb import stl_to_glb; stl_to_glb("examples/synthetic-guide/assets/renders/lamp-shade.stl", "examples/synthetic-guide/assets/renders/lamp-shade.glb")'
```

Nothing here is a photograph of a real product.

## Commands

From the repository root, after `npm install` and `npm run build`:

```sh
node packages/cli/dist/bin.js check --project examples/synthetic-guide
node packages/cli/dist/bin.js render --project examples/synthetic-guide
cd site && npx astro build && cd ..
node packages/cli/dist/bin.js check --project examples/synthetic-guide --dist site/dist
```

`render` rewrites `build/render/manifest.json` identically except for the `rendered_at` timestamps. `check --dist` rewrites `build/carbon.json`. Both files are committed.
