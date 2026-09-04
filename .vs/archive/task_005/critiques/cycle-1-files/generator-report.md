# Generator report — task_005 cycle 1

Commit `8b32521` on `vsss/task_005-themes` (worktree `/workspace/.claude/worktrees/task_005`).
Files: `packages/themes/**`, `site/**`, `examples/synthetic-guide/**`, root `package-lock.json`. 55 files, +1824 / -318 (the lockfile loses `"dev": true` flags because `site` now depends on astro and starlight as production dependencies).

## Verification (run in this order, Node 22.23.2, repo root)

```
npm install                                                                 → exit 0, "found 0 vulnerabilities"
npm run build                                                               → exit 0, "[build] 16 page(s) built" (root build includes site/)
node packages/cli/dist/bin.js check --project examples/synthetic-guide      → exit 0, "errors: 0, warnings: 0"
node packages/cli/dist/bin.js render --project examples/synthetic-guide     → exit 0, "rendered 0, cached 0, hand-exported 3, skipped 0, failed 0"
cd site && npx astro build                                                  → exit 0, "[build] 16 page(s) built in 3.42s" / "[build] Complete!"
node packages/cli/dist/bin.js check --project examples/synthetic-guide --dist site/dist → exit 0, "errors: 0, warnings: 0"
```

Six theme states: `node scratchpad/theme-cycle-test.mjs` (fake `document`, `localStorage`, `matchMedia`) against `packages/themes/dist/*.js` → "theme cycle: 6 states OK, first-paint script OK, storage keys OK". It checks the cycle order, the `<html>` attributes and both storage keys at each of the six states, wrap-around, the Starlight-value mapping on first load, auto re-resolution on a media-query change, and the first-paint script (applies a stored state, ignores junk, does nothing with nothing stored).

Stability: a second `astro build` plus `check --dist` reproduces `build/carbon.json` byte-for-byte; a second `render` reproduces `build/render/manifest.json` except the three `rendered_at` values.

Byte weight: `pioreactor.css` 4454 B unminified; element `dist/docsi-theme.js` 7582 B + `state.js` 3591 B (Astro inlines the bundled, minified form once per page); `head.js` 1472 B (the inline script itself is about 330 B).

## Per-AC notes

1. `pioreactor.css` sets all twelve pack-settable `--docsi-*` tokens and `--sl-color-accent/-high/-low`, `--sl-color-bg`, `--sl-font`, `--sl-font-mono` from the table (dark bg/text/muted are Starlight's dark gray ramp via `var()`, as the table says). Header states re-implementation from published token facts and cites T9. `grep -rE "fonts\.googleapis|--ifm-|\.menu__|\.navbar__|\.theme-doc|AssemblyInstructionBlock|pioreactor\.com" packages/themes site examples site/dist` → nothing.
2. No font files anywhere (`find … -iname '*.woff*' -o -iname '*.ttf'` → nothing); no external stylesheet or font request in the built pages. Stacks are exactly the two listed. README carries the font decision and the self-hosted `@font-face` route.
3. Cycle order, `docsandeye-theme` key, `data-docsi-pack` / `data-theme` on `<html>`, `prefers-color-scheme` resolution with a `change` listener, Starlight `starlight-theme` mapped on first load. First-paint script registered through Starlight `head` via `themeHead()` from `@docsandeye/themes/head.js` (an `.astro` file cannot carry a companion export, so the helper lives in the package). Button is a native `<button type="button">` with `aria-label="Theme: <label>. Activate to change."` and a visually hidden text span; Enter and Space work natively. No-JS: `<docsi-theme hidden>` server-rendered, removed on upgrade, pack CSS applies when the attribute is absent. `ThemeSelect.astro` is in `exports` and resolves (the build used it). Built pages: 16 of 16 contain `<docsi-theme` (two per page: header and mobile menu footer, one shared inline script); 0 contain `<starlight-theme-select`.
4. `marks/mark-pioreactor.svg` is a zero-byte file. `ThemeSelect.astro` imports only `mark-neutral.svg` and the three bases. README: activation requires Martin's sign-off on T29 plus a `theme_mark` core config key.
5. Zero problems under core; render and check outputs above; manifest and carbon report committed and reproducible.
6. Site builds offline (npm only). Guide index at `/example/`, steps at `/example/step-0N-…/`. Authoring pages use only names from `packages/core/src/schemas.ts` (spot-checked field by field while writing: `derived_files`, `master_format`, `supersedes`, `depends_on`, `supplier.mpn`, `cat`, `viewer.format`, `duration_s`, `narration_source`, `byte_budget_kb`, `hosting.base`).
7. Step pages with the pioreactor pack active: 109264 B (106.7 KB), 108471 B (105.9 KB), 107828 B (105.3 KB), 105867 B (103.4 KB); all under 150 KB; `build/carbon.json` committed. Composition: HTML ≈ 22 KB, Starlight+plugin+pack CSS ≈ 73 KB, Expressive Code CSS ≈ 18 KB, scripts ≈ 8 KB, images 0.6 to 1.7 KB each. The model-viewer chunk (1 MB) is a dynamic import and is not part of the initial load.
8. Docs pages: short sentences, no em dashes (`grep "—"` over the docs → nothing), commands bare in fenced blocks, no angle-bracket placeholders (the `cli.md` synopses are concrete commands; options are described in tables), no marketing on reference pages; `index.mdx` is the one page with a hero and cards, drawn from README.md.
9. Diff touches only `packages/themes`, `site`, `examples`, `package-lock.json`. `TODO.md`, `CHANGELOG.md`, `README.md`, `.vs/spec.md`, `.vs/tasks.json`, `.vs/progress.md` untouched.
10. Nothing from pioreactor.com: no logo, wordmark, screenshot or asset. All SVGs, PNGs, the STL and the GLB are generated here (`scratchpad/make-assets.py`, hand-written SVG paths, the pipeline's `stl_to_glb`).

## Ambiguity choices

- Pack scope: rules apply to `:root[data-docsi-pack='pioreactor']` and to `:root:not([data-docsi-pack])`, so the JavaScript-disabled page shows the config's pack. Dark values also apply when `data-theme` is absent, because Starlight renders dark until its own script sets the attribute; matching it avoids a light pack on a dark Starlight page.
- The control mirrors the mode into Starlight's `starlight-theme` (`light`, `dark`, or empty for auto) so Starlight's own inline `ThemeProvider` (still rendered by `Page.astro`) resolves the same `data-theme` and never fights the control.
- The head script is pack-agnostic: it applies any well-formed `<pack>-<mode>` and the element corrects a pack mismatch after upgrade (`loadState` accepts only the config pack or `starlight`). Passing the pack name into `themeHead()` would duplicate `docsandeye.config.yaml` in `astro.config.mjs`.
- State labels: "Pioreactor, follows system", "Pioreactor light", …; "Pioreactor" is `packLabel(config.theme)`, so another pack name reads correctly. A site on the stock pack gets the three Starlight states only.
- Mark placement: the moon and half-circle bases carry a `data-mark-transform` so the cut-out lands on painted area (the icon centre is empty on a crescent).
- Example media: the video file is not committed (CONTRIBUTING: never commit rendered video); the plugin logs one "missing render/media file, not copied" warning for it during `astro build`. The example README says so. Photos are flat PNG illustrations (about 1.5 KB) rather than JPEG, since the container has no image library.
- Example content exercises all three staleness statuses (STALE photo in step 1, CHANGED_IN_FRAME photo in step 3, FRESH video poster in step 2). Changelog dates are months old so the 30-day "updated" badge does not toggle with the build date and `carbon.json` stays reproducible.
- `build/render-plan.json` is committed alongside the manifest; `render` rewrites it identically (canonical JSON).
- Extra `exports`: `./head.js` and `./package.json` in addition to the four the spec lists.
- `site/.gitignore` (`.astro/`, `dist/`, `node_modules/`) and `site/public/favicon.svg` (own drawing of the neutral mark) added; without the favicon every page 404s once.
- `site` is a workspace with a `build` script, so root `npm run build` also builds the site; the site's `prebuild` compiles the four packages so Cloudflare's `npm run build` in `site/` is self-sufficient.

## Plugin and core follow-ups (not fixed here; those tasks own them)

1. `docsSchema({ extend: stepFrontmatterSchema })` makes every step field required on every docs entry. `stepFrontmatterSchema.partial()` throws in zod 4 ("cannot be used on object schemas containing refinements"). `site/src/content.config.ts` rebuilds the fields from `stepFrontmatterSchema.shape` and calls `.partial()` on that. The plugin should export an optional variant (or a `docsandeyeDocsSchema()` helper) and the CLI template's `content.config.ts` should use it.
2. Hand-exported jobs list all `derived_files` as outputs and `renderUrl()` takes `outputs[0]` for both a render and the viewer, so one component cannot serve an SVG render and a GLB viewer. The example works around it (base and arm: SVG only; shade: GLB first, STL second). Core or the plugin should choose the derived file by the requested `format`.
3. The plugin warns about a missing video `file` at build time even though this release shows posters only; consider skipping the copy (or the warning) for `data-docsi-video="reserved"` media until v0.2.
4. `themeHead()` has to be added by the site config; the plugin knows `config.theme` and could inject the first-paint script (or a `<meta name="docsandeye:pack">`) itself.
5. Astro renders the boolean `hidden` as `hidden="true"`; valid HTML, noted for anyone grepping for the bare attribute.
