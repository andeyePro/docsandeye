# task_003 — Generator report, cycle 1

Branch `vsss/task_003-plugin`, worktree `/workspace/.claude/worktrees/task_003`.
Commit **dd31363** `feat(plugin): starlight-docsandeye — guide/step routes, custom elements, theme wiring`
(preceded by merge commit db089d0 `Merge branch 'main'`, taken so the fixture `component@version` strings fall under
main's `path-warn:packages/*/fixtures/*` allowlist instead of bypassing the content guard).

Environment: Node 22.23.2 (`export PATH=$HOME/.local/node22/bin:$PATH`), npm 10.9.8, Astro 7.3.1, Starlight 0.42.0,
Vite 8.2.2 (rolldown/oxc), `@google/model-viewer` 4.3.1, `node-html-parser` 9.0.3, `@astrojs/markdown-remark` 7.3.0.

## Exact commands and final output lines

All run from the worktree root unless noted; foreground, `timeout: 600000`.

| Command | Final output |
|---|---|
| `npm install --no-audit --no-fund` | `added 2 packages, and changed 338 packages in 1m` (root lockfile updated) |
| `npm run build` | core + plugin `tsc -p tsconfig.json`, exit 0 |
| `npm run typecheck -w starlight-docsandeye` | exit 0 |
| `npm test` (root vitest, projects `packages/*`) | `Test Files 10 passed (10)`, `Tests 213 passed (213)` — plugin package has no `test/` yet (Tester-owned), `passWithNoTests` |
| `cd packages/starlight-docsandeye/fixtures/site && DOCSANDEYE_BUILD_DATE=2026-09-04 ../../../../node_modules/.bin/astro build` | `[build] 7 page(s) built in 6.96s` / `[build] Complete!`, exit 0; `[starlight-docsandeye] copied 6 render/media file(s) into _docsandeye/` |
| `… DOCSANDEYE_MAINTAINER=1 DOCSANDEYE_BUILD_DATE=2026-09-04 ../../../../node_modules/.bin/astro build --outDir ./dist-maintainer` | `[build] 8 page(s) built in 3.05s` / `Complete!`, exit 0 (adds `reshoot/index.html`) |
| `cd packages/starlight-docsandeye/fixtures/site-bad-theme && ../../../../node_modules/.bin/astro build` | exit 1; stderr line 1 `[ERROR] [@astrojs/starlight] An unhandled error occurred while running the "astro:config:setup" hook`, line 2 `unknown theme "nope" (expected the stock "starlight" pack or a resolvable @docsandeye/themes/nope.css)`; no `dist/` created |
| `npx vitest run --root .vs/cycle-1/scratch-tests` | `Test Files 2 passed (2)`, `Tests 18 passed (18)` |

`npx astro …` also works from inside `fixtures/site` (`npx --no-install astro --version` → `astro v7.3.1`), since npm
adds every ancestor `node_modules/.bin` to PATH. The Astro build does **not** need `dist/` of the plugin package: the
fixture site imports `../../index.ts` / `../../../schema.ts` (Vite handles TS) and the routes, components and CSS are
referenced as `starlight-docsandeye/src/…` package specifiers resolved through the root `node_modules` workspace symlink.
Scratch tests: `.vs/cycle-1/scratch-tests/{unit,build}.test.ts` (gitignored). `build.test.ts` asserts on a pre-built
`fixtures/site/dist` and `fixtures/site/dist-maintainer` (both gitignored via the package `.gitignore`).

TDD trail: unit tests were written before the first `tsc` build and run red on the type error / missing dist;
`build.test.ts` was red on (a) a Starlight SSR externalisation failure, (b) `StarlightPage` frontmatter validation,
(c) `/>` meta serialisation, (d) oxc re-quoting `customElements.define(`docsi-…`)`, (e) my own wrong reshoot order
expectation — each fixed in turn (details under "Ambiguity choices").

## Per-AC mapping

| AC | Where | Evidence |
|---|---|---|
| 1 Plugin registration | `src/plugin.ts` (`name: 'starlight-docsandeye'`, `hooks['config:setup']`), `src/theme.ts` (`resolveThemeCss` → `unknown theme "<name>"`) | fixture site build exit 0; site-bad-theme exit 1 with stderr `unknown theme "nope"` |
| 2 Schema export | `schema.ts` re-exports core's `StepFrontmatterSchema` (no filename check by construction); `fixtures/step-cases.json` (`valid`: 4 step files; `invalid`: missing order → `order`, duplicate render id → `renders.1.id`, unknown cat → `parts.0.cat`) | scratch `unit.test.ts` AC2 |
| 3 Routes | `src/integration.ts` injects `<base>` → `Guide.astro`, `<base>/[step]` → `Step.astro` per guide; `Step.astro#getStaticPaths({ routePattern })` picks the guide from the pattern so `stepsForGuide` yields only that guide's steps (orphan `guide: []` never appears); `/reshoot` injected only when `data.maintainer` | dist has AEP/, MEP/, AEP/step-01-raft, AEP/step-02-cap, MEP/step-01-raft, MEP/step-03-mep-only; no AEP/step-03…, MEP/step-02…, step-04-orphan, reshoot |
| 4 Step markup (no-JS) | `src/components/StepPage.astro`, `MediaPane.astro`, `PartsList.astro`; markdown via `src/markdown.ts` (`@astrojs/markdown-remark`); copy step `src/assets.ts` from `astro:build:done` | raw HTML contains, in order: `<docsi-step data-step="step-02-cap">`, `<div class="docsi-media">`, `<img src="/_docsandeye/render/vial-cap@2.0.0--cap-iso--0fd0f88538ea.png" alt="cap-iso">`, `<docsi-model data-src="…viewer--d2ced720dce2.glb">` with sole child `<a href="…glb">Download 3D model</a>`, `<div class="docsi-text">`, `<h1>Fit the vial cap</h1>`, body, `<section class="docsi-parts">` with `<li data-component="vial-cap" data-qty="1" data-cat="printed">` …, `<section class="docsi-tools">`, `<aside class="docsi-safety">`; files under `dist/_docsandeye/render/` and `dist/_docsandeye/media/` |
| 5 Custom elements | `src/elements/index.ts` (three literal `customElements.define(...)`), `docsi-step.ts`, `docsi-model.ts` (`addEventListener(` at offset 711, first `import(` at 1086), `docsi-lightbox.ts`; `<script>import '../elements/index.ts'</script>` in `StepPage.astro`; `generateBundle` in `src/integration.ts` re-quotes the define calls to `"` | registering script `_astro/StepPage.astro_astro_type_script_index_0_lang.*.js` = **3250 bytes**, only module script containing all three defines; separate chunk `_astro/model-viewer.min.*.js` (1 018 040 bytes) contains `model-viewer`; no static import of three/model-viewer in `src/elements/*.ts` |
| 6 Staleness | `src/view.ts` (`staleSummary`, `changedInFrameNote`, `describeChanges`), `StalenessDetails.astro`, `MediaItem.astro` (STALE items rendered after in-flow items, inside `<details class="docsi-stale">`) | summary text exactly `A photo exists for this step, but Vial Cap has changed since it was taken (v1.0.0 → v2.0.0)`; `<li>` with `2.0.0 … Port layout rework.` precedes the `<img>`; video poster `<img … data-docsi-video="reserved">` in flow followed by `<p class="docsi-note">Vial Cap also appears in this video …</p>`; step-01 photo plain |
| 7 Sidebar badges | `src/components/Sidebar.astro` (components override, no route middleware), `stepBadges` in `src/view.ts` | `<ol class="docsi-steps">` lists step-01-raft, step-02-cap; step-02 li carries `<span class="docsi-badge docsi-badge-stale">stale media</span>` and `<span class="docsi-badge docsi-badge-updated">updated</span>`; step-01 none; MEP lists step-01-raft, step-03-mep-only |
| 8 Reshoot | `src/routes/Reshoot.astro` over `buildReshootIndex` | `dist-maintainer/reshoot/index.html`: rows `vial-cap` (`class="docsi-stale"`, appearances photo-02-cap/hero/STALE, vid-02-seat/in_frame/CHANGED_IN_FRAME), then `anode`, then `top-stop` (core order, see ambiguity 1); each row has name, `<code>current</code>`, per-appearance media id, role, status |
| 9 Metadata + carbon | `src/components/Head.astro` override emits `<meta name="docsandeye:step" content="…">` / `docsandeye:guide`; `CarbonFigure.astro` + `carbonFor`/`formatCarbon` | step-02 head has both metas (plain `>`), body has `<span class="docsi-carbon">≈ 0.01 g CO₂e per view</span>`; step-01 has no `docsi-carbon`; MEP pages carry `content="mep"` |
| 10 Guide index | `src/routes/Guide.astro` (`Astro.routePattern` → guide) | `<ol class="docsi-guide-steps">` links `/AEP/step-01-raft/` "Print the raft" `2 parts`, `/AEP/step-02-cap/` "Fit the vial cap" `3 parts`; `href="/reshoot/"` present only in the maintainer build |
| 11 Theme wiring | `src/plugin.ts` (`customCss: [...user, docsandeye.css, theme-<name>.css]`, `components: { ...PLUGIN_COMPONENTS, ...user }`), `src/styles/docsandeye.css`, `src/styles/theme-starlight.css` | scratch AC11: recording `updateConfig` sees customCss ending `[docsandeye.css, theme-starlight.css]`, components has `Sidebar` (…/Sidebar.astro) and untouched user `ThemeSelect`; built `_astro/*.css` contains `--docsi-media-col:55%` and `:root[data-theme=dark]` |
| 12 Virtual module | `src/virtual.ts` (`createDocsandeyeVitePlugin`, `serialiseDocsandeyeData`: self-contained module, Maps as `new Map([...])`), `src/data.ts` (`loadDocsandeyeData(projectRoot, env)`) | scratch AC12: `resolveId('virtual:docsandeye/model')` truthy, `load()` string evaluated via data URL exports the seven names, `staleness['photo-02-cap'].status === 'STALE'` |
| 13 Hygiene | `package.json` (deps: `@astrojs/markdown-remark` 7.3.0, `@docsandeye/core` 0.1.0, `@google/model-viewer` 4.3.1; devDeps `@astrojs/starlight` 0.42.0, `astro` 7.3.1, `node-html-parser` 9.0.3, `vitest` 5.0.0; peers `^0.42.0` / `^7.2.0`); `tsconfig.json` (`rootDir .`, `.astro`/CSS shipped as source under `src/`) | `npm run build -w starlight-docsandeye` exit 0; `npm test` green; no sharp/lit/react/preact/vue/svelte in any field |

## Ambiguity choices and notes for the Tester

1. **AC8 row order.** The spec sentence says "vial-cap first … then top-stop and anode", but the AC binds to
   "core's `buildReshootIndex` order", which is `staleHeroCount` desc then `component` asc → `vial-cap, anode, top-stop`.
   I followed core. Derive the expectation from `buildReshootIndex(model, staleness)` rather than hard-coding.
2. **`<meta>` serialisation.** Starlight's frontmatter `head` renders dynamic tags as `<meta … />`. To emit the spec's
   literal `<meta name="docsandeye:step" content="…">` the plugin overrides `Head` (renders Starlight's default Head
   then the two metas from the route marker). Consequence: a site that overrides `Head` itself must render
   `starlight-docsandeye/src/components/Head.astro` as its default or the metas disappear (user keys win by spec).
3. **`PageTitle` override.** Starlight renders its own `<h1 id="_top">` above the content; the spec wants the `<h1>` inside
   `.docsi-text`. The plugin overrides `PageTitle` to render nothing on step pages (default elsewhere). The skip-link
   target `id="_top"` moves to the wrapper `<div class="not-content docsi-step-wrap" id="_top" data-guide="…">` that
   encloses `<docsi-step>` (the wrapper also opts the layout out of Starlight's markdown styles; the rendered body
   re-enters them with `sl-markdown-content`). `<docsi-step>`, `.docsi-media`, `.docsi-text`, the render `<img>`,
   `<docsi-model>`, its `<a>`, `<h1>`, `<details>`, the badges and the carbon span carry exactly the attributes the
   spec quotes and nothing else, so raw-string assertions match.
4. **`stepFrontmatterSchema` and `docsSchema({ extend })`.** The export is core's `StepFrontmatterSchema` itself (one
   source of truth; the id-vs-filename check lives in `parseStep`, not the schema). Starlight's `deepMergeSchemas`
   makes the step fields *required* for every `docs` entry, and `<StarlightPage>` validates its `frontmatter` prop
   against that user schema, so: step pages pass the full step frontmatter through `StarlightPage` (typed route data);
   Guide/Reshoot pages pass `id`/`order` placeholders; the fixture site has an empty `docs` collection (a plain
   `index.md` would fail validation under the spec-mandated `content.config.ts`).
5. **Framework detection.** Astro marks packages as SSR-`noExternal` by crawling the *project's* `package.json`
   dependencies (vitefu). A fixture site with no dependencies externalised `@astrojs/starlight/locals`, whose
   `astro:middleware` import then failed in Node (`ERR_UNSUPPORTED_ESM_URL_SCHEME … 'astro:'`). Both fixture sites
   therefore declare `dependencies` for `astro`, `@astrojs/starlight` and `starlight-docsandeye` (resolved from the
   root `node_modules`; the fixtures are not workspaces, nothing to install). Real sites always list these.
6. **Registering-script quotes.** Vite 8's oxc minifier prints string literals with backticks; the integration's Vite
   plugin re-quotes `customElements.define(`docsi-…`)` to `"` in `generateBundle` so the canonical form is present
   regardless of the Tester's quote normaliser. The dynamic import stays as `import("./model-viewer.min.*.js")`.
7. **3D viewer.** `docsi-model.ts` dynamically imports `@google/model-viewer/dist/model-viewer.min.js` (the pre-bundled
   ESM build with three inside) only from the "View in 3D" click handler; `src/elements/modules.d.ts` declares the
   untyped subpath. `@google/model-viewer` transitively depends on `lit`; it is not in this package's `package.json`.
8. **Media hosting.** Media files/posters are copied only when `hosting.provider === 'local'`; other providers resolve
   URLs through core's `resolveMediaUrl`. Missing source files are warned about, never fatal. Basename collisions
   across directories would overwrite (first wins) — noted, not solved.
9. **Sidebar shape.** On Docs&I pages the sidebar shows the current guide (title link + `<ol class="docsi-steps">`),
   "Other guides" links, and the reshoot link in maintainer builds; the badges are siblings of the `<a>` inside the
   `<li>` (link text stays the bare title). `updated` = any component referenced by parts/tools/renders/viewer or the
   step's media pins has a latest changelog date within 30 days before `DOCSANDEYE_BUILD_DATE`.
10. **Loader failures fail the build.** `loadDocsandeyeData` throws a `DocsiError` listing every core problem instead of
    generating pages from an invalid tree; `DOCSANDEYE_BUILD_DATE` is validated as `YYYY-MM-DD`.
11. **Dev server.** `configureServer` serves `/_docsandeye/*` from the project during `astro dev`; not exercised here
    (no browser / no dev run) — build-only verification.
12. **Extra files** beyond the spec layout: `src/components/Head.astro`, `PageTitle.astro`, `MediaItem.astro`,
    `src/assets.ts`, `src/markdown.ts`, `src/view.ts`, `src/virtual-model.d.ts`, `src/elements/modules.d.ts`,
    `fixtures/*/package.json`, `fixtures/*/tsconfig.json`, `fixtures/*/public/.gitkeep`,
    `fixtures/*/src/content/docs/.gitkeep`. `fixtures/project-bad-theme` is a full copy of `fixtures/project`
    with `theme: nope`.

## Core contract

Sufficient; `packages/core/**` untouched. Used: `loadProject`, `stepsForGuide`, `computeStaleness`,
`buildReshootIndex`, `renderJobKey`, `resolveMediaUrl`, `StepFrontmatterSchema`, `DocsiError` and the types.
Render job keys in the fixture manifest (`vial-cap@2.0.0--cap-iso--0fd0f88538ea`, `vial-cap@2.0.0--viewer--d2ced720dce2`)
were computed once with `buildRenderPlan` on the fixture project and committed.

## Unmet

Nothing known. Not covered by tests here: `astro dev` asset middleware; behaviour of a site that itself overrides
`Head`/`PageTitle`/`Sidebar` (documented above).
