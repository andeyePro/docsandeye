/**
 * Per-page byte budget over a built site (`dist/`) and the CO2.js estimate.
 * Static analysis only: the HTML on disk plus the local assets a browser
 * would fetch for the initial load of a step page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';
import { co2 } from '@tgwf/co2';

export const STEP_META_NAME = 'docsandeye:step';

export interface PageBudget {
  /** Site-relative URL path with leading and trailing slash, e.g. `/AEP/step-02-cap/`. */
  page: string;
  bytes: number;
  gco2e: number;
  /** Local hrefs that did not resolve to a file, in document order, each once. */
  missing: string[];
}

export interface BudgetReport {
  pages: PageBudget[];
  warnings: string[];
}

/** All `index.html` files under `dir`, sorted by path. */
export function findIndexPages(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of fs.readdirSync(d).sort()) {
      const abs = path.join(d, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) walk(abs);
      else if (name === 'index.html' && stat.isFile()) out.push(abs);
    }
  };
  walk(dir);
  return out.sort();
}

/** `<dir>/AEP/step-02-cap/index.html` → `/AEP/step-02-cap/`; `<dir>/index.html` → `/`. */
export function pagePath(dir: string, htmlPath: string): string {
  const rel = path.relative(dir, path.dirname(htmlPath)).split(path.sep).filter((s) => s !== '' && s !== '.');
  return rel.length === 0 ? '/' : `/${rel.join('/')}/`;
}

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** Local file for an href, or undefined when the URL is remote (`http:`, `data:`, `//host/…`) or empty. */
export function resolveHref(href: string, dir: string, pageDir: string): string | undefined {
  const trimmed = href.trim();
  if (trimmed === '' || trimmed.startsWith('//') || SCHEME_RE.test(trimmed)) return undefined;
  const withoutSuffix = trimmed.replace(/[?#].*$/, '');
  let decoded = withoutSuffix;
  try {
    decoded = decodeURIComponent(withoutSuffix);
  } catch {
    /* keep the raw path */
  }
  if (decoded.startsWith('/')) return path.join(dir, ...decoded.split('/').filter(Boolean));
  return path.resolve(pageDir, decoded);
}

/** Candidate URLs of a `srcset` attribute (descriptors dropped). */
export function srcsetCandidates(srcset: string): string[] {
  return srcset
    .split(',')
    .map((c) => c.trim().split(/\s+/)[0] ?? '')
    .filter((u) => u !== '');
}

function relTokens(el: HTMLElement): Set<string> {
  return new Set((el.getAttribute('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean));
}

const LINK_RELS = new Set(['stylesheet', 'modulepreload', 'preload']);

/** hrefs (as written) the initial load fetches: single assets and srcset groups. */
export function collectReferences(root: HTMLElement): { single: string[]; srcsets: string[][] } {
  const single: string[] = [];
  const srcsets: string[][] = [];
  for (const link of root.querySelectorAll('link[href]')) {
    const rels = relTokens(link);
    if ([...rels].some((r) => LINK_RELS.has(r))) single.push(link.getAttribute('href') ?? '');
  }
  for (const script of root.querySelectorAll('script[src]')) single.push(script.getAttribute('src') ?? '');
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (src !== undefined) single.push(src);
    const srcset = img.getAttribute('srcset');
    if (srcset !== undefined) srcsets.push(srcsetCandidates(srcset));
  }
  for (const source of root.querySelectorAll('source[srcset]')) srcsets.push(srcsetCandidates(source.getAttribute('srcset') ?? ''));
  for (const video of root.querySelectorAll('video[poster]')) single.push(video.getAttribute('poster') ?? '');
  return { single, srcsets };
}

function fileSize(abs: string): number | undefined {
  try {
    const stat = fs.statSync(abs);
    return stat.isFile() ? stat.size : undefined;
  } catch {
    return undefined;
  }
}

/** Initial-load bytes of one step page; `undefined` when the page is not a step page. */
export function measurePage(dir: string, htmlPath: string): { bytes: number; missing: string[] } | undefined {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const root = parse(html);
  if (!root.querySelector(`meta[name="${STEP_META_NAME}"]`)) return undefined;

  const pageDir = path.dirname(htmlPath);
  const counted = new Set<string>();
  const missing: string[] = [];
  let bytes = fs.statSync(htmlPath).size;

  const noteMissing = (href: string): void => {
    if (!missing.includes(href)) missing.push(href);
  };
  const add = (abs: string, size: number): void => {
    if (counted.has(abs)) return; // a browser fetches each URL once
    counted.add(abs);
    bytes += size;
  };

  const { single, srcsets } = collectReferences(root);
  for (const href of single) {
    const abs = resolveHref(href, dir, pageDir);
    if (abs === undefined) continue;
    const size = fileSize(abs);
    if (size === undefined) noteMissing(href);
    else add(abs, size);
  }
  for (const candidates of srcsets) {
    let best: { abs: string; size: number } | undefined;
    for (const href of candidates) {
      const abs = resolveHref(href, dir, pageDir);
      if (abs === undefined) continue;
      const size = fileSize(abs);
      if (size === undefined) noteMissing(href);
      else if (!best || size > best.size) best = { abs, size };
    }
    if (best) add(best.abs, best.size);
  }
  return { bytes, missing };
}

/** Sustainable Web Design model v4, grams CO2e for `bytes` transferred. */
export function gramsCo2e(bytes: number): number {
  return new co2({ model: 'swd', version: 4 }).perByte(bytes);
}

/** Walk `dir`, measure every step page and produce the warning lines. */
export function analyseDist(dir: string, budgetKb: number): BudgetReport {
  const pages: PageBudget[] = [];
  const warnings: string[] = [];
  const limit = budgetKb * 1024;
  for (const htmlPath of findIndexPages(dir)) {
    const measured = measurePage(dir, htmlPath);
    if (!measured) continue;
    const page = pagePath(dir, htmlPath);
    for (const href of measured.missing) warnings.push(`budget: ${page} missing asset ${href}`);
    if (measured.bytes > limit) warnings.push(`budget: ${page} ${Math.round(measured.bytes / 1024)} KB > ${budgetKb} KB`);
    pages.push({ page, bytes: measured.bytes, gco2e: gramsCo2e(measured.bytes), missing: measured.missing });
  }
  return { pages, warnings };
}

/** The `build/carbon.json` document (task_003 reads it). */
export function carbonDocument(pages: readonly PageBudget[]): { version: 1; pages: Record<string, { bytes: number; gco2e: number }> } {
  const out: Record<string, { bytes: number; gco2e: number }> = {};
  for (const p of pages) out[p.page] = { bytes: p.bytes, gco2e: p.gco2e };
  return { version: 1, pages: out };
}
