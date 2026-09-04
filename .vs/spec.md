# task_003 — `starlight-docsandeye`: the Starlight plugin, custom elements and theme wiring

## Task summary

Build the Starlight plugin that turns a project's `docs/` tree (validated by `@docsandeye/core`, task_001) into guide pages: it registers the project model as a virtual module, extends Starlight's `docsSchema()` so step frontmatter is typed, generates one route per step and per guide, renders each step through the `<docsi-step>` custom element (two-column layout: media pane with renders, 3D viewer and media thumbnails; text pane with the step's Markdown, parts list and safety note), computes staleness at build time and derives sidebar badges from it, emits the `/reshoot` maintainer dashboard in maintainer builds, and stamps every step page with the metadata the CLI's byte-budget check reads. The interactive core is framework-agnostic vanilla custom elements with a static-HTML fallback, so the same markup works with JavaScript disabled and can later be embedded elsewhere. Theme packs (task_005) plug in through the project config's `theme` field and the CSS-token contract defined here; this task ships only the stock `starlight` pack and the contract.

Decisions already made (do not reopen): Astro + Starlight (0.42.x, Astro 7); vanilla custom elements, not Lit; the guide must be complete with video disabled; renders and staleness JSON are produced before `astro build` by the CLI (this plugin reads `build/render/manifest.json` and computes staleness itself from the model, it never renders); videos are v0.2 — this task renders photo media, and video manifests as their poster only; a guide is identified by `config.guides[].id` and served under `base` (e.g. `/AEP`), with a sibling guide (`/MEP`) sharing steps; theme selection comes from `docsandeye.config.yaml` `theme`, never from a plugin option; no `sharp` and no Astro image service (plain `<img>` and a static copy step).

## Package layout (owns `packages/starlight-docsandeye/**` only)

```
packages/starlight-docsandeye/package.json     name starlight-docsandeye, type module; peerDeps @astrojs/starlight ^0.42, astro ^7.2; deps @docsandeye/core (workspace); devDeps vitest, node-html-parser; NO sharp, lit, react, preact, vue, svelte
packages/starlight-docsandeye/index.ts         export default function docsandeye(options?: {projectRoot?: string}): StarlightPlugin   (projectRoot default: the Astro project root)
packages/starlight-docsandeye/schema.ts        export { stepFrontmatterSchema }  (Zod object = core's step frontmatter shape minus filename-dependent checks)
packages/starlight-docsandeye/src/plugin.ts    'config:setup' hook: updateConfig (customCss order, components override for Sidebar, head tags), addIntegration(createDocsandeyeIntegration(...))
packages/starlight-docsandeye/src/integration.ts   export createDocsandeyeIntegration(opts): AstroIntegration — astro:config:setup: injectRoute for /<base>/, /<base>/<step-id>/, and /reshoot (maintainer builds only); registers the vite plugin; astro:build:done: static copy step (below)
packages/starlight-docsandeye/src/virtual.ts   export createDocsandeyeVitePlugin(data: DocsandeyeData): Plugin — serves `virtual:docsandeye/model`
packages/starlight-docsandeye/src/data.ts      export loadDocsandeyeData(projectRoot, env): DocsandeyeData = { config, model, staleness, renderManifest, carbon, buildDate, maintainer }
packages/starlight-docsandeye/src/routes/Guide.astro, Step.astro, Reshoot.astro
packages/starlight-docsandeye/src/components/StepPage.astro, PartsList.astro, MediaPane.astro, StalenessDetails.astro, CarbonFigure.astro, Sidebar.astro (override adding badges)
packages/starlight-docsandeye/src/elements/index.ts, docsi-step.ts, docsi-model.ts, docsi-lightbox.ts   custom elements; index.ts is the single client entry
packages/starlight-docsandeye/src/styles/docsandeye.css      layout + the --docsi-* token contract with defaults mapped onto Starlight's --sl-* tokens
packages/starlight-docsandeye/src/styles/theme-starlight.css the stock pack (token defaults restated; present so theme "starlight" resolves)
packages/starlight-docsandeye/test/            Tester-owned (vitest)
packages/starlight-docsandeye/fixtures/project/   Generator-owned Docs&I project (see below)
packages/starlight-docsandeye/fixtures/site/      Generator-owned Starlight site: astro.config.mjs with starlight({ plugins: [docsandeye({ projectRoot: '../project' })] }), image: { service: passthroughImageService() }, src/content.config.ts using docsSchema({ extend: stepFrontmatterSchema })
packages/starlight-docsandeye/fixtures/project-bad-theme/  a copy of fixtures/project whose docsandeye.config.yaml sets theme: nope
packages/starlight-docsandeye/fixtures/site-bad-theme/     same site config pointing projectRoot at '../project-bad-theme'
```

Fixture project (Generator-owned, normative for the tests): config `guides: [{id: aep, title: "Aseptic", base: /AEP}, {id: mep, title: "Mixed", base: /MEP}]`, `theme: starlight`; components `vial-cap` (design_version 2.0.0, changelog 1.0.0 dated 2026-01-10, 2.0.0 dated 2026-08-20), `top-stop` (1.3.0, changelog dated 2026-03-01), `anode` (1.0.0, off-the-shelf, no source files), `blank-cap` (master_format f3z, 1.0.0); steps `step-01-raft` (guide `[aep, mep]`, order 1), `step-02-cap` (guide `aep`, order 2, one render of `vial-cap`, viewer `vial-cap` glb, media `[photo-02-cap, vid-02-seat]`, safety set), `step-03-mep-only` (guide `mep`, order 3), `step-04-orphan` (guide `[]`, order 4 — core accepts an empty array; the plugin generates no route for it); media `photo-02-cap` (type photo, hero `[vial-cap@1.0.0]` → STALE), `vid-02-seat` (type video, hero `[top-stop@1.3.0]`, in_frame `[vial-cap@1.0.0]` → CHANGED_IN_FRAME), `photo-01-raft` (type photo on step-01, hero `[anode@1.0.0]` → FRESH); `build/render/manifest.json` — this is task_002's output artefact (shape: `{"version": 1, "jobs": {"<key>": {"status", "driver", "outputs": [...], "rendered_at", ...}}}`, distinct from core's `build/render-plan.json`, which the plugin never reads) with `rendered` entries and stub files for `vial-cap@2.0.0--cap-iso--<hash>.png` and `vial-cap@2.0.0--viewer--<hash>.glb` (hash values as produced by core's `buildRenderPlan`, computed once by the Generator and committed); `build/carbon.json` with an entry for `/AEP/step-02-cap/` only.

## Static copy step (normative)

In `astro:build:done`, copy every file listed in `renderManifest.jobs[*].outputs` from `<projectRoot>/<output>` to `<dist>/_docsandeye/render/<basename>`, and every media `file`/`poster` from `<projectRoot>/<file>` to `<dist>/_docsandeye/media/<basename>`; page markup references these `/_docsandeye/...` paths. No image transformation, no `astro:assets`.

## `carbon.json` (normative here; task_004 writes it, this plugin reads it)

```json
{"version": 1, "pages": {"/AEP/step-02-cap/": {"bytes": 123456, "gco2e": 0.0118}}}
```

Keys are site-relative URL paths with leading and trailing slash, matching the route's `Astro.url.pathname` (with `base` prefix). Absent file → `carbon` is `null`.

## Environment contract

`DOCSANDEYE_BUILD_DATE` (ISO date `YYYY-MM-DD`; default today) fixes the "updated within 30 days" reference date. `DOCSANDEYE_MAINTAINER=1` enables the `/reshoot` route and the link to it; unset, neither exists in `dist/`.

## Token contract (normative; task_005's packs override these only)

```
--docsi-accent, --docsi-accent-high, --docsi-accent-low   default var(--sl-color-accent), -high, -low
--docsi-bg, --docsi-text, --docsi-text-muted             default var(--sl-color-bg), var(--sl-color-text), var(--sl-color-gray-3)
--docsi-media-col: 55%   --docsi-text-col: 44%           the step layout split
--docsi-stale-bg, --docsi-stale-fg                       the staleness details colours
--docsi-badge-stale-bg, --docsi-badge-updated-bg
--docsi-font-body, --docsi-font-mono                     default var(--sl-font), var(--sl-font-mono)
--docsi-logo-mark: none                                  the theme-cycle mark (task_005)
```

A pack is one CSS file setting these on `:root` and on `:root[data-theme='dark']`. The plugin adds `docsandeye.css` then `theme-<name>.css`, resolved from the plugin's own `src/styles/` for `starlight`, else from the package `@docsandeye/themes/<name>.css`; if neither resolves the build fails with `unknown theme "<name>"`.

## Acceptance criteria

Verification model: the Tester runs `astro build` on `fixtures/site` once per test file (foreground, `timeout: 600000`, `DOCSANDEYE_BUILD_DATE=2026-09-04`, and separately with `DOCSANDEYE_MAINTAINER=1`) and asserts on `dist/` with `node-html-parser`.

1. **Plugin registration.** `docsandeye()` returns an object with `name: 'starlight-docsandeye'` and a `hooks['config:setup']` function; `astro build` of `fixtures/site` exits 0; `astro build` of `fixtures/site-bad-theme` exits non-zero with stderr containing `unknown theme "nope"`.
2. **Schema export.** `stepFrontmatterSchema` validates the frontmatter of every fixture step and rejects each of these three inputs (table committed at `fixtures/step-cases.json`, used by the test): missing `order`; duplicate render `id`; unknown `cat`. Filename-dependent checks (id vs filename) are explicitly not part of this schema.
3. **Routes.** `dist/` contains `AEP/index.html`, `MEP/index.html`, `AEP/step-01-raft/index.html`, `AEP/step-02-cap/index.html`, `MEP/step-01-raft/index.html`, `MEP/step-03-mep-only/index.html`, and does NOT contain `AEP/step-03-mep-only/`, `MEP/step-02-cap/`, or any `step-04-orphan/` directory; without `DOCSANDEYE_MAINTAINER` there is no `reshoot/` directory.
4. **Step page markup (no-JS fallback).** `AEP/step-02-cap/index.html` contains, in document order inside `<docsi-step data-step="step-02-cap">`: `<div class="docsi-media">` with an `<img src="/_docsandeye/render/vial-cap@2.0.0--cap-iso--<hash>.png" alt="cap-iso">`, a `<docsi-model data-src="/_docsandeye/render/vial-cap@2.0.0--viewer--<hash>.glb">` whose light-DOM child is `<a href="…glb">Download 3D model</a>`, and the media items per AC6; `<div class="docsi-text">` with an `<h1>` equal to the step title, the rendered Markdown body, `<section class="docsi-parts">` listing each part as `<li data-component="<id>" data-qty="<n>" data-cat="<cat>">` containing the component's `name`, a tools list, and `<aside class="docsi-safety">` containing the safety text. The copied files exist at `dist/_docsandeye/render/…` and `dist/_docsandeye/media/…`. The test asserts on raw HTML only.
5. **Custom elements upgrade, not replace.** Exactly one `<script type="module" src="…">` on each step page points at a built file whose content contains all three strings `customElements.define("docsi-step"`, `customElements.define("docsi-model"`, `customElements.define("docsi-lightbox"` (quote style may vary; the test normalises quotes) — that file is "the registering script"; its size is under 25 KB. Source-level check: `src/elements/*.ts` contain no static `import` whose specifier contains `three` or `model-viewer`; the only reference to a 3D library is a dynamic `import()` inside `docsi-model.ts`, and in that file's source the first occurrence of `import(` comes after the first occurrence of `addEventListener(` (the test asserts the character offsets), and `dist/` contains a separate chunk (not the registering script) whose content includes the string `model-viewer` (the viewer implementation is `@google/model-viewer`, loaded on demand).
6. **Staleness details and demotion.** For `photo-02-cap` (STALE), the media pane places the render and viewer first and the photo inside `<details class="docsi-stale">` whose `<summary>` text is `A photo exists for this step, but Vial Cap has changed since it was taken (v1.0.0 → v2.0.0)`; the changelog entry `2.0.0` note appears as an `<li>` inside the details before the `<img>`. For `vid-02-seat` (CHANGED_IN_FRAME) the poster `<img>` is in normal flow followed by `<p class="docsi-note">` mentioning `Vial Cap`, and the `<img>` carries `data-docsi-video="reserved"`. For `photo-01-raft` (FRESH, on step-01) the `<img>` is in normal flow with no details and no note. Wording uses `A video exists for this step, but … since it was filmed` for stale videos.
7. **Sidebar badges.** On every guide page the sidebar (a `components.Sidebar` override; route middleware is not used for this) lists the guide's steps in `order`; `step-02-cap` carries `<span class="docsi-badge docsi-badge-stale">stale media</span>` and `<span class="docsi-badge docsi-badge-updated">updated</span>` (vial-cap's latest changelog date 2026-08-20 is within 30 days of 2026-09-04); `step-01-raft` carries neither.
8. **Reshoot dashboard.** With `DOCSANDEYE_MAINTAINER=1`, `reshoot/index.html` contains a table with rows in core's `buildReshootIndex` order: `vial-cap` first (one STALE hero appearance) with `class="docsi-stale"`, then `top-stop` and `anode`; each row lists component name, current version and, per appearance, media id, role and status.
9. **Page metadata for the CLI.** Every step page `<head>` contains `<meta name="docsandeye:step" content="<step id>">` and `<meta name="docsandeye:guide" content="<guide id>">`; `AEP/step-02-cap/index.html` renders `<span class="docsi-carbon">≈ 0.01 g CO₂e per view</span>` (two decimals from the fixture's `carbon.json`), and `AEP/step-01-raft/index.html` has no `docsi-carbon` span.
10. **Guide index.** `AEP/index.html` lists the aep steps as links in order with their titles and the number of `parts` entries; it links to `/reshoot/` only when built with `DOCSANDEYE_MAINTAINER=1`.
11. **Theme wiring.** A unit test invokes `hooks['config:setup']` with a recording `updateConfig` and asserts `customCss` ends with `[…docsandeye.css, …theme-starlight.css]` in that order and that `components.Sidebar` points at the plugin's `Sidebar.astro`; the built CSS in `dist/` contains `--docsi-media-col:55%` (whitespace-insensitive) and a `:root[data-theme=dark]` (or `'dark'`) block.
12. **Virtual module contract.** `createDocsandeyeVitePlugin(data)` returns a Vite plugin whose `resolveId('virtual:docsandeye/model')` is truthy and whose `load()` for the resolved id returns a module string exporting `config`, `model`, `staleness`, `renderManifest`, `carbon`, `buildDate`, `maintainer`; a unit test evaluates the returned string with `import()` via a data URL and checks `staleness['photo-02-cap'].status === 'STALE'` for the fixture project's data from `loadDocsandeyeData`.
13. **Package hygiene.** `npm run build -w starlight-docsandeye` (tsc for `.ts`; `.astro` shipped as source) succeeds; `npm test` passes; `package.json` lists none of `sharp`, `lit`, `react`, `preact`, `vue`, `svelte` in any dependency field.

## Out of scope

- Video playback, posters as facades, WebVTT, the "watch the older video" flow (v0.2). No `<docsi-video>`, no `<docsi-diff>`.
- The Pioreactor theme pack, the six-state theme cycle and the logo marks (task_005); this task ships the token contract and the stock pack only.
- The dogfood site and example project content (task_005); the CLI (task_004); rendering (task_002); writing `carbon.json` (task_004).
- i18n strings beyond English; search configuration (Pagefind stays at Starlight defaults).
- Do not edit `README.md`, `TODO.md`, `CHANGELOG.md`, `.vs/tasks.json`, `.vs/progress.md`, or any file outside `packages/starlight-docsandeye/**`. If core's contract is insufficient, report it in the generator report rather than patching core.

## Test location

`packages/starlight-docsandeye/test/` (vitest). Generator scratch tests only under `.vs/cycle-<N>/scratch-tests/`.

## Proposed budget

4 cycles. Rationale: three moving parts (plugin config, Astro integration routes, custom elements) plus an `astro build` in the loop; the first cycle usually surfaces a route or virtual-module wiring issue.

## Model plan

- Generator: **fable** (pre-authorised), ceiling fable. Rationale: Starlight 0.42 plugin API + Astro 7 integration + SSR-safe custom elements with a mandatory no-JS fallback is long-horizon, cross-layer work; a wrong shape here forces rework in tasks 004 and 005.
- Spec Critic: sonnet. Tester: haiku, ceiling sonnet on test-quality findings.
- Fable rung: **pre-authorised (--fable-subagents)**.
