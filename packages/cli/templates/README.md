# {{title_text}}

Hardware documentation built with [Docs&I](https://github.com/amy-bo/docsandeye): versioned components,
build steps and media, published as a Starlight site.

## Layout

- `docsandeye.config.yaml` — guides, hosting and the page byte budget
- `docs/components/*.yaml` — one file per part, with `design_version` and its CAD `source_files`
- `docs/steps/*.md` — build steps (frontmatter lists parts, tools, renders, media)
- `docs/media/*.yaml` — manifests for committed photos and videos
- `astro.config.mjs`, `src/content.config.ts` — the Starlight site, wired to `starlight-docsandeye`

## Commands

```sh
npm install
docsandeye render          # writes build/render-plan.json and renders CAD views (needs python3 + OpenSCAD/CadQuery)
npm run build              # astro build → dist/
docsandeye check --dist dist   # validation, version-bump guard, byte budget + CO2e per step page
```

Renders are produced locally and committed; nothing is rendered in CI.
