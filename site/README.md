# docs.andeye.com

The Docs&I documentation site. Starlight plus the `starlight-docsandeye` plugin, hosting the synthetic example guide from `../examples/synthetic-guide` under `/example/`.

## Local build

From the repository root:

```sh
npm install
npm run build
cd site
npx astro build
```

`npm run build` at the root compiles the workspace packages the site imports (`@docsandeye/core`, `starlight-docsandeye`, `@docsandeye/themes`, `docsandeye`). Inside `site/`, `npm run build` does the same through its `prebuild` script and then runs `astro build`. Output is `site/dist/`.

Check the built pages against the byte budget and write `../examples/synthetic-guide/build/carbon.json`:

```sh
npm run check
```

Preview locally with `npm run dev`.

## Cloudflare Pages

House convention: a git-connected Pages project.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `site` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` |

`npm install` runs in `site/`, where npm finds the workspace root one level up and installs every workspace. The `prebuild` script then compiles the packages before `astro build`. No Python is needed on Pages: renders are hand-exported or committed, never produced in CI.

Custom domain: `docs.andeye.com`, added in the Pages project's custom domains tab. DNS is a CNAME to the `pages.dev` hostname. Both steps are done in the Cloudflare dashboard.

## Content

- `src/content/docs/` holds the documentation pages (Markdown and MDX).
- `astro.config.mjs` wires the plugin, the theme control (`components.ThemeSelect`), the theme pack (the plugin injects the first-paint script itself), the passthrough image service and the sidebar.
- `src/content.config.ts` extends Starlight's `docs` schema with the step fields as optional, because this collection holds ordinary pages as well as the generated step pages.

Voice: short sentences, no marketing on reference pages, commands shown bare in fenced blocks.
