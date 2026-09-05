/**
 * Theme-pack resolution. The stock `starlight` pack ships in this package;
 * any other name must resolve to `@docsandeye/themes/<name>.css` from the
 * Astro project, otherwise the build fails with `unknown theme "<name>"`.
 */
import { createRequire } from 'node:module';
import path from 'node:path';

export const STOCK_THEME = 'starlight';
export const STOCK_THEME_CSS = 'starlight-docsandeye/src/styles/theme-starlight.css';

export function resolveThemeCss(theme: string, astroRoot: string): string {
  if (theme === STOCK_THEME) return STOCK_THEME_CSS;
  const specifier = `@docsandeye/themes/${theme}.css`;
  try {
    createRequire(path.join(path.resolve(astroRoot), 'package.json')).resolve(specifier);
  } catch {
    throw new Error(`unknown theme "${theme}" (expected the stock "starlight" pack or a resolvable ${specifier})`);
  }
  return specifier;
}

/** One entry of Starlight's `head` config (the shape `@docsandeye/themes` returns). */
export interface HeadEntry {
  tag: 'base' | 'link' | 'meta' | 'noscript' | 'script' | 'style' | 'template' | 'title';
  attrs?: Record<string, string | boolean | undefined>;
  content?: string;
}

/** Attribute the themes package stamps on its first-paint script; the idempotence marker. */
export const THEME_HEAD_MARKER = 'data-docsi-theme';

/** Where the first-paint script comes from. Resolved by name, never imported statically. */
export const THEME_HEAD_SPECIFIER = '@docsandeye/themes/head.js';

/**
 * Starlight `head` entries for a theme pack: the themes package's first-paint
 * script, which applies the reader's stored pack and mode to <html> before the
 * page renders. The stock `starlight` pack has no state to restore, so it gets
 * none.
 *
 * Resolved from the Astro project by package name, exactly as the theme CSS is,
 * so this package never depends on `@docsandeye/themes`. A pack whose CSS
 * resolves but whose head script does not (an old or unbuilt themes package)
 * is not fatal: `warn` is told and the site builds without the script, showing
 * the configured pack rather than the reader's stored one.
 */
export function resolveThemeHead(theme: string, astroRoot: string, warn?: (message: string) => void): HeadEntry[] {
  if (theme === STOCK_THEME) return [];
  try {
    const load = createRequire(path.join(path.resolve(astroRoot), 'package.json'));
    const mod = load(THEME_HEAD_SPECIFIER) as { themeHead?: () => HeadEntry[] };
    if (typeof mod.themeHead !== 'function') throw new Error(`${THEME_HEAD_SPECIFIER} exports no themeHead()`);
    return mod.themeHead();
  } catch (err) {
    warn?.(`theme "${theme}": no first-paint script (${THEME_HEAD_SPECIFIER}: ${err instanceof Error ? err.message : String(err)})`);
    return [];
  }
}

/** True when `head` already carries `entry`, by marker attribute or identical content. */
export function hasThemeHead(head: readonly HeadEntry[], entry: HeadEntry): boolean {
  return head.some(
    (h) =>
      h.tag === entry.tag &&
      (h.attrs?.[THEME_HEAD_MARKER] !== undefined || (entry.content !== undefined && h.content === entry.content)),
  );
}
