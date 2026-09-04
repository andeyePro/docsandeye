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
