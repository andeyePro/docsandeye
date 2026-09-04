/**
 * The first-paint script: applies the stored theme state to <html> before the
 * page renders, so a reader who chose Starlight dark does not see a flash of
 * the pack. Register it through Starlight's `head` option:
 *
 *   import { themeHead } from '@docsandeye/themes/head.js';
 *   starlight({ head: themeHead() })
 *
 * With nothing stored the script does nothing: the page renders in the
 * config's pack (the pack stylesheet applies when `data-docsi-pack` is absent)
 * and Starlight's own inline script resolves light or dark, exactly as it
 * does on a site without Docs&I.
 */
import { LIGHT_SCHEME_QUERY, STORAGE_KEY } from './state.ts';

/** One entry of Starlight's `head` config. */
export interface HeadEntry {
  tag: 'script';
  attrs?: Record<string, string | boolean | undefined>;
  content: string;
}

/** The inline script as a string, for callers that inject it themselves. */
export const FIRST_PAINT_SCRIPT: string = [
  '(function(){try{',
  `var v=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(!v)return;`,
  'var i=v.lastIndexOf("-");if(i<1)return;',
  'var p=v.slice(0,i),m=v.slice(i+1);',
  'if(!/^[a-z0-9][a-z0-9-]*$/.test(p)||(m!=="auto"&&m!=="light"&&m!=="dark"))return;',
  'var d=document.documentElement;d.dataset.docsiPack=p;',
  `d.dataset.theme=m==="auto"?(matchMedia(${JSON.stringify(LIGHT_SCHEME_QUERY)}).matches?"light":"dark"):m;`,
  '}catch(e){}})();',
].join('');

/** Starlight `head` entries for the theme control. */
export function themeHead(): HeadEntry[] {
  return [{ tag: 'script', attrs: { 'data-docsi-theme': '' }, content: FIRST_PAINT_SCRIPT }];
}
