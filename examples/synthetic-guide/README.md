# Synthetic guide: a bench lamp

A small made-up hardware project that exercises the whole Docs&I engine without CAD tools. It is the example guide on docs.andeye.com, served under `/example/`.

- Three printed parts (`lamp-base`, `lamp-arm`, `lamp-shade`) and two off-the-shelf parts (`m3-screw`, `led-module`).
- Four steps.
- Two photos and one video manifest. The video shows as its poster; playback is the next release. The video file itself is not committed (the repository never carries rendered video), so the site build logs one "missing render/media file" warning for it.
- Every printed part is hand-exported (`master_format: none` with `derived_files`), so `docsandeye render` completes with `hand-exported 3` and renders nothing.

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
