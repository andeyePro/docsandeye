---
title: Carbon
description: The per-page byte budget, how initial-load bytes are counted, and the CO2e estimate.
---

Every step page has a byte budget for its initial load. `docsandeye check --dist dist` measures each built step page against it and writes `build/carbon.json`. The estimate is printed on the page at the next build.

## The budget

```yaml
byte_budget_kb: 150
```

`docsandeye.config.yaml` sets the budget in kilobytes (1024 bytes). Default 150. A page over budget is a warning; `--strict` turns warnings into errors for CI.

## What is counted

The check reads each `index.html` under `dist/` that carries a `docsandeye:step` meta tag, then adds the on-disk size of every local file a browser fetches on first load:

- the HTML itself;
- stylesheets, `modulepreload` and `preload` links;
- scripts with a `src`;
- every `img` `src`, and the largest candidate of each `srcset`;
- video posters.

Each URL counts once. Remote URLs are not counted. A local file that does not exist is a warning. Video files are never counted: a step page transfers no video bytes until the reader presses play.

## The estimate

Grams of CO2e per view come from CO2.js using the Sustainable Web Design model, version 4, applied to the counted bytes. The figure is shown at the foot of each step page as "≈ 0.02 g CO₂e per view".

## carbon.json

```json
{
  "version": 1,
  "pages": {
    "/example/step-01-print-the-parts/": {"bytes": 88231, "gco2e": 0.0121}
  }
}
```

Keys are site-relative paths with leading and trailing slash. Commit the file. The plugin reads it at build time; a page with no entry shows no figure.

## Keeping under budget

- Keep posters and photos small. The example guide uses flat PNG illustrations under 2 KB each.
- Prefer SVG line art for drawings.
- The 3D viewer library loads only when a reader presses "View in 3D". It is not part of the initial load.
- The theme pack ships no font files.
