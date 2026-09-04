# task_005 — the Pioreactor theme pack, the six-state theme cycle, the dogfood site and the example project (`--fuzzy`)

## Task summary

Ship the appearance layer and the two things that prove the engine end to end: (1) `@docsandeye/themes`, containing the `pioreactor` pack (re-implemented from published token values only; no CSS or JavaScript copied from docs.pioreactor.com) whose font stacks name Roboto and Source Code Pro but ship no font files (decision below); (2) the `<docsi-theme>` control, wrapped in a `ThemeSelect.astro` override, that replaces Starlight's theme select and cycles through six states with a changing logo; (3) `examples/synthetic-guide/`, a small made-up hardware project (a bench lamp: three printed parts, two off-the-shelf parts, four steps, two photos, one video manifest rendered as poster) whose components use hand-exported derived files so the real CLI and render pipeline run to completion without OpenSCAD; (4) `site/`, the Docs&I documentation site itself, built with Starlight + the plugin, hosting the synthetic guide under `/example/` and the authoring docs, deployable to Cloudflare Pages as docs.andeye.com by the house convention (git-connected Pages project, root `site`, `npm run build`, `dist`).

Mode is `--fuzzy`: "matches the Pioreactor look", "the cycle feels right" and "the docs read well" have no mechanical test; a Sonnet Reviewer judges the diff against the criteria below, and Martin is shown the Reviewer's verdict on the look before it is accepted (hard-escalate: subjective verdicts are never auto-passed).

Decisions already made: default pack for electroPioreactor is `pioreactor` (Martin: "asking forgiveness is easier than permission" for the token-level re-implementation); the cycle order is Pioreactor inherit → Pioreactor light → Pioreactor dark → Starlight inherit → Starlight dark → Starlight light; a plain picker is acceptable if the cycling logo is expensive; the Pioreactor triple-dot "P" mark is a trademark and its use is an open question (T29): this task ships a neutral mark and the swap point stays inert until Martin signs off. The stock `starlight` pack lives inside the plugin (task_003) and is not part of this package.

Sequencing (chair commitment): dispatched after task_003 and task_004 have merged to `main` and this worktree is rebased, so the plugin, its token contract and the CLI exist.

## Package and file layout (owns `packages/themes/**`, `site/**`, `examples/**` only)

```
packages/themes/package.json          name @docsandeye/themes, "exports": {"./pioreactor.css": "./pioreactor.css", "./ThemeSelect.astro": "./ThemeSelect.astro", "./docsi-theme.js": "./dist/docsi-theme.js", "./marks/*": "./marks/*"}
packages/themes/pioreactor.css        the pack: the pack-settable tokens scoped to :root[data-docsi-pack='pioreactor'] and :root[data-docsi-pack='pioreactor'][data-theme='dark'], then the sidebar and badge rules written against Starlight's own class names and the --docsi-* contract
packages/themes/marks/base-auto.svg, base-light.svg (sun), base-dark.svg (moon)   the three backgrounds
packages/themes/marks/mark-neutral.svg    the default mark cut in negative relief (a simple "docs eye": a circle with a horizontal lens line)
packages/themes/marks/mark-pioreactor.svg the swap point — SHIPPED EMPTY; the element ignores it unless `docsandeye.config.yaml` sets `theme_mark: pioreactor` (a config key this task does not add to core; until core has it, the README says the swap requires Martin's sign-off on T29 and a core change, so the file cannot silently activate)
packages/themes/README.md             how a pack works, the token contract pointer, the font decision (no files shipped; how a site may add its own @font-face later), the mark swap rule
packages/themes/src/docsi-theme.ts    the <docsi-theme> element (vanilla), built to dist/docsi-theme.js
packages/themes/ThemeSelect.astro     Starlight ThemeSelect override: imports { config } from 'virtual:docsandeye/model' (task_003's virtual module) and renders <docsi-theme data-pack={config.theme}> with the three inline SVG bases and the mark as light-DOM <template>s, a visually hidden label, and a <script> that imports @docsandeye/themes/docsi-theme.js; receives Starlight's Props and ignores them
examples/synthetic-guide/             docsandeye.config.yaml (guides: [{id: lamp, title: "Bench lamp", base: /example}], theme: pioreactor), docs/components (5: three printed parts with master_format none and core's `derived_files` field pointing at committed assets/renders/*.svg|png|glb; two off-the-shelf), docs/steps (4), docs/media (3: two photos, one video manifest with a committed poster), assets/ (small SVG line-art, PNG posters ≤ 20 KB each, one GLB produced with task_002's STL→GLB converter from a hand-written cube STL), build/render/manifest.json (committed; identical to what `docsandeye render` regenerates, because every job is hand-exported), build/carbon.json (committed output of `docsandeye check --dist`)
site/astro.config.mjs                 starlight({ title: 'Docs&I', plugins: [docsandeye({ projectRoot: '../examples/synthetic-guide' })], components: { ThemeSelect: '@docsandeye/themes/ThemeSelect.astro' } }), image: { service: passthroughImageService() }
site/src/content/docs/                index.mdx (what Docs&I is, from README), getting-started.md (init → author → render → check → build), authoring/components.md, authoring/steps.md, authoring/media.md, staleness.md, themes.md, carbon.md, cli.md, licence.md
site/package.json                     scripts: build → astro build, dev → astro dev; deploy notes for Cloudflare Pages in site/README.md
```

## Pioreactor pack — values (normative; facts, not copied expression)

```
--docsi-accent #5331ca; --docsi-accent-high #332083; --docsi-accent-low #8c6be9        (light)
--docsi-accent #b7a6ff; --docsi-accent-high #dcd5ff; --docsi-accent-low #4a2bb9        (dark)
--docsi-bg #f6f6f7; --docsi-text #1c1e21; --docsi-text-muted #4a4a4a                   (light); dark values from Starlight's own dark gray ramp
--docsi-stale-bg #ffefa4; --docsi-stale-fg #1c1e21
--docsi-badge-updated-bg #ddffdc (text #176114); --docsi-badge-stale-bg #ffefa4 (text #1c1e21)
--docsi-font-body "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --docsi-font-mono "Source Code Pro", Menlo, monospace
--sl-color-accent and its -high/-low, --sl-color-bg, --sl-font, --sl-font-mono set to the same values so Starlight's own chrome follows the pack
sidebar: 14 px links; active item: 2 px solid right border in accent, border-radius 0
```

The two layout tokens are not set by the pack (task_003 contract). Everything in `pioreactor.css` must be authored against the `--docsi-*` contract and Starlight's `--sl-*` custom properties and class names; no selector may be copied from Docusaurus/Infima (`.menu__link`, `.navbar__*`, `--ifm-*` must not appear).

Font decision (Planner, 2026-09-04): the pack ships NO font files and makes NO external font request. Upstream Roboto publishes only TTF (no woff2) and the container has no subsetting tool, and every byte of webfont is carbon on every page view. The stacks name Roboto and Source Code Pro first so devices that have them (Android, many Linux desktops, anyone with the fonts installed) match the Pioreactor look exactly; everyone else gets the system font. The README explains how a site can add its own `@font-face` rules if it wants the webfonts.

## The theme cycle (normative)

`<docsi-theme>` renders a single `<button type="button" aria-label="Theme: <state label>. Activate to change.">` containing an inline `<svg>` composed of the state's base (auto = half-filled circle, light = sun, dark = moon) with the mark cut out in negative relief (an SVG `<mask>`), plus a visually hidden `<span>` with the state label. Clicking or pressing Enter/Space advances: `pioreactor-auto → pioreactor-light → pioreactor-dark → starlight-auto → starlight-dark → starlight-light → pioreactor-auto`. The element writes `data-docsi-pack` (`pioreactor` | `starlight`) and `data-theme` (`light` | `dark`, with `auto` resolved from `prefers-color-scheme` exactly as Starlight does, and re-resolved on `change` of that media query) on `<html>`, stores the state in `localStorage['docsandeye-theme']`, and on first load with no stored state maps an existing Starlight `starlight-theme` value onto the config's pack. In the Starlight states the three bases are used without the mark. An inline `<script>` in `<head>` (registered through the plugin's head config by `ThemeSelect.astro`'s companion `head` export, or by the site config) applies the stored state before first paint. With JavaScript disabled the page renders in the config's pack, `auto`, and the control is hidden with the `hidden` attribute.

## Acceptance criteria (heuristic, judged from the diff and by running the stated commands)

1. `pioreactor.css` sets every pack-settable `--docsi-*` token from the task_003 contract and the listed `--sl-*` tokens using only the values in the table; a reviewer grepping for `--ifm-`, `.menu__`, `.navbar__`, `.theme-doc`, `AssemblyInstructionBlock` or `fonts.googleapis` finds nothing; the file header states the values are published token facts re-implemented and cites the decision (T9).
2. No font files ship and no stylesheet or page requests a font from any external host; the two font stacks are exactly as listed; the README carries the font decision.
3. The six-state cycle is implemented in the stated order with the stated storage key, `<html>` attributes and first-paint script; the button is keyboard operable with a meaningful `aria-label`; the no-JS fallback is as stated; `ThemeSelect.astro` is exported and resolvable through the package `exports` map, and the built site's pages contain `<docsi-theme` and no Starlight `<starlight-theme-select`.
4. The mark swap is inert: `mark-pioreactor.svg` is empty, nothing reads it, and the README states that activating it requires Martin's sign-off on T29 plus a core config key.
5. `examples/synthetic-guide` loads with zero problems under core; `docsandeye render --project examples/synthetic-guide` exits 0 with summary `rendered 0, cached 0, hand-exported N, skipped 0, failed 0` and leaves `build/render/manifest.json` byte-identical except `rendered_at`; `docsandeye check --project examples/synthetic-guide --dist site/dist` reports `errors: 0, warnings: 0` (the reviewer runs these from the repo root with Node 22 on `PATH`).
6. `site/` builds with `astro build` under Node 22 in the container with no network access beyond npm; the example guide appears under `/example/`; every authoring page's code samples use field names that exist in `packages/core/src/schemas.ts` (the reviewer spot-checks).
7. Every step page of the built site is under the 150 KB poster-only budget with the pioreactor pack active (this is the same bar as criterion 5's zero warnings); the reviewer records the numbers from `build/carbon.json` in the verdict.
8. The docs are in the same voice as README.md: short sentences, no marketing inside reference pages, no em dashes, commands shown bare in fenced blocks with no angle-bracket placeholders.
9. No file outside `packages/themes/**`, `site/**`, `examples/**` is modified; `TODO.md`, `CHANGELOG.md`, `.vs/*` untouched.
10. Nothing in the diff embeds the Pioreactor logo, wordmark, screenshots or any asset from pioreactor.com.

## Out of scope

- Video playback (v0.2).
- Publishing to Cloudflare (Martin does the dashboard step); DNS.
- Any pack other than `pioreactor`; an `amybo` pack is a later item; the `starlight` pack is task_003's.
- Changing the plugin's token contract or core's config schema (if something is missing, report it; those tasks own it).
- Real CAD renders (the example uses hand-exported derived files by design).

## Review focus

- Token-only re-implementation: no copied selectors, values beyond the table, or third-party assets; no font files, no external font requests.
- Cycle correctness and accessibility; first-paint flash handling; interaction with Starlight's own `starlight-theme` storage; the `components` merge surviving (task_003 guarantees user overrides win).
- Example project validity under the real CLI and pipeline; committed manifest stable across runs.
- Docs accuracy against the shipped schemas and CLI flags.
- Byte weight of the pack.

## Proposed budget

3 cycles.

## Model plan

- Generator: **opus**, ceiling fable (pre-authorised). Rationale: CSS, an SVG mask, a small element and documentation prose — judgment-heavy, not long-horizon.
- Spec Critic: sonnet. Reviewer: sonnet (`--fuzzy`).
- Fable rung: pre-authorised (--fable-subagents) but not the starting tier.
