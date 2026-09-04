# @docsandeye/themes

Theme packs for Starlight sites built with `starlight-docsandeye`, plus the `<docsi-theme>` control that replaces Starlight's theme select.

This package ships one pack, `pioreactor`. The stock `starlight` pack lives inside the plugin.

## How a pack works

A pack is one CSS file, `<name>.css`, resolved by the plugin as `@docsandeye/themes/<name>.css` when `docsandeye.config.yaml` says `theme: <name>`. The plugin loads its own layout stylesheet first, then the pack. The pack sets two groups of custom properties on `:root`:

- the pack-settable `--docsi-*` tokens of the plugin's token contract (`packages/starlight-docsandeye/src/styles/docsandeye.css`): accent, accent-high, accent-low, bg, text, text-muted, stale-bg, stale-fg, badge-updated-bg, badge-stale-bg, font-body, font-mono;
- the matching `--sl-*` tokens (`--sl-color-accent`, `--sl-color-accent-high`, `--sl-color-accent-low`, `--sl-color-bg`, `--sl-font`, `--sl-font-mono`) so Starlight's own chrome follows the pack.

The two layout tokens, `--docsi-media-col` and `--docsi-text-col`, belong to the plugin. A pack never sets them.

Light values go on the base selector, dark values under `[data-theme='dark']`. The pack's rules are scoped to `:root[data-docsi-pack='<name>']` and also apply when `data-docsi-pack` is absent, which is what a page without JavaScript looks like. Without JavaScript Starlight renders its dark palette until its own script runs, so the pack's dark values also apply when `data-theme` is absent.

Beyond tokens a pack may write rules against Starlight's class names (`.sidebar-content a`) and the plugin's (`.docsi-steps a`, `.docsi-badge-stale`). It must not copy selectors, rules or assets from any other site. The `pioreactor` pack is a re-implementation of published token values only: colours, font names, the 14 px sidebar links and the 2 px accent bar on the active item. Decision T9.

## Fonts

The `pioreactor` pack names Roboto and Source Code Pro first in its font stacks:

```
--docsi-font-body: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
--docsi-font-mono: "Source Code Pro", Menlo, monospace
```

It ships no font files and makes no external font request. Reasons: every byte of webfont is carbon on every page view; upstream Roboto publishes TTF only, not woff2; and the build container has no subsetting tool. Devices that already have the fonts (Android, many Linux desktops, anyone who installed them) match the look exactly. Everyone else gets the system font.

A site that wants the webfonts adds its own `@font-face` rules in a stylesheet listed in Starlight's `customCss`, pointing at font files it hosts itself:

```css
@font-face {
  font-family: "Roboto";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/roboto-400.woff2") format("woff2");
}
```

Keep the `font-family` names as written so the pack's stacks pick them up. Do not link to a font CDN; that sends every visitor's address to a third party and adds a request to every page.

## The theme control

`ThemeSelect.astro` is a Starlight component override. Wire it and the first-paint script in `astro.config.mjs`:

```js
import { themeHead } from '@docsandeye/themes/head.js';

starlight({
  plugins: [docsandeye({ projectRoot: '../examples/synthetic-guide' })],
  components: { ThemeSelect: '@docsandeye/themes/ThemeSelect.astro' },
  head: themeHead(),
})
```

The plugin merges its own component overrides with yours and your keys win, so `ThemeSelect` survives.

The control cycles through six states:

1. Pioreactor, follows system
2. Pioreactor light
3. Pioreactor dark
4. Starlight, follows system
5. Starlight dark
6. Starlight light

"Pioreactor" here is whatever pack the config names. A site on the stock pack gets only the three Starlight states.

Each state writes `data-docsi-pack` (`pioreactor` or `starlight`) and `data-theme` (`light` or `dark`; "follows system" is resolved from `prefers-color-scheme` and re-resolved when it changes) on `<html>`. The state is stored in `localStorage['docsandeye-theme']` as `<pack>-<mode>`. On first load with nothing stored, Starlight's own `starlight-theme` value is mapped onto the config's pack. The mode is mirrored back into `starlight-theme` so Starlight's inline script and this control never disagree.

The button carries `aria-label="Theme: <state>. Activate to change."` and a visually hidden text label. Click, Enter and Space advance the cycle. The icon is the state's base (half-filled circle, sun, moon) with the mark cut out through an SVG mask in the pack states, and the bare base in the Starlight states.

`themeHead()` returns a Starlight `head` entry holding a small inline script. It applies a stored state before first paint. With nothing stored it does nothing and the page renders in the config's pack.

Without JavaScript the control stays hidden (`hidden` attribute, server-rendered) and the page renders in the config's pack.

## Marks

`marks/` holds the three bases and the marks:

- `base-auto.svg`, `base-light.svg`, `base-dark.svg`: the backgrounds.
- `mark-neutral.svg`: the default mark, a circle with a horizontal lens line.
- `mark-pioreactor.svg`: the swap point. Shipped empty. Nothing reads it.

The mark swap rule: the Pioreactor triple-dot mark is a trademark and its use is an open question (T29). Activating `mark-pioreactor.svg` requires two things that this package does not provide: Martin's sign-off on T29, and a `theme_mark` key in core's config schema for `docsandeye.config.yaml` so the choice is explicit in the project. Until both exist, dropping content into the file changes nothing.

## Files

```
pioreactor.css        the pack
ThemeSelect.astro     Starlight ThemeSelect override
src/state.ts          state names, storage keys, the cycle
src/docsi-theme.ts    the <docsi-theme> element (built to dist/docsi-theme.js)
src/head.ts           themeHead() and the first-paint script (built to dist/head.js)
marks/*.svg           bases and marks
```

Build with `npm run build -w @docsandeye/themes`.

## Licence

AGPL-3.0-only with the Docs&I additional permission: sites generated with these packs are not covered works. See the repository LICENSE.
