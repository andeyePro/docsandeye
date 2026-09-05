---
title: Themes
description: Theme packs, the pioreactor pack, and the six-state theme control.
---

The look of a Docs&I site comes from a theme pack. `docsandeye.config.yaml` names it:

```yaml
theme: pioreactor
```

`starlight` is the stock pack, shipped inside the plugin. Any other name resolves to `@docsandeye/themes/<name>.css`. Only `pioreactor` exists today. An unknown name fails the build.

## What a pack sets

A pack is one CSS file. It sets the pack-settable `--docsi-*` tokens (accent, background, text, stale and badge colours, font stacks) and the matching Starlight `--sl-*` tokens so Starlight's own chrome follows. It may add rules against Starlight's and the plugin's class names. It never sets the two layout tokens, `--docsi-media-col` and `--docsi-text-col`.

## The pioreactor pack

A re-implementation of the Pioreactor documentation look from published token values: the purple accent, the light grey page, the 14 px sidebar with a 2 px accent bar on the active item. No CSS or JavaScript is copied from that site.

The font stacks name Roboto and Source Code Pro first. The pack ships no font files and makes no external font request. Devices with the fonts installed match the look exactly; everyone else gets the system font. A site that wants the webfonts adds its own `@font-face` rules for files it hosts. The package README explains how.

The pack is a re-implementation from published token values only. No CSS, JavaScript or asset is copied from any other site, and the pack contains no logo. Decision T9.

## The theme control

The control in the header replaces Starlight's theme select. Click it, or press Enter or Space on it, to move through six states:

1. Pioreactor, follows system
2. Pioreactor light
3. Pioreactor dark
4. Starlight, follows system
5. Starlight dark
6. Starlight light

The icon shows the state: a half-filled circle, a sun or a moon, with a small mark cut out in the Pioreactor states. The button's accessible name reads "Theme: Pioreactor dark. Activate to change."

Each state sets `data-docsi-pack` and `data-theme` on `<html>`. The choice is kept in `localStorage` under `docsandeye-theme` and mirrored into Starlight's `starlight-theme`. A small inline script in `<head>` applies the stored state before the first paint. With JavaScript disabled the control is hidden and the page renders in the config's pack.

## Wiring

```js
import docsandeye from 'starlight-docsandeye';
import { themeHead } from '@docsandeye/themes/head.js';

starlight({
  plugins: [docsandeye({ projectRoot: '../examples/synthetic-guide' })],
  components: { ThemeSelect: '@docsandeye/themes/ThemeSelect.astro' },
  head: themeHead(),
})
```

## Marks

The mark cut into the icon is a plain letter P, not the Pioreactor triple-dot mark. The package holds an empty `mark-pioreactor.svg` as a swap point. Nothing reads it. Using the Pioreactor mark is a trademark question (T29). Activating the swap needs sign-off on T29 and a `theme_mark` key in core's config schema, neither of which exists yet.
