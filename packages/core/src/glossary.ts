/**
 * Glossary tooltips: the pure text work behind `docs/glossary.yaml`.
 *
 * - `linkGlossaryTerms` wraps the first occurrence of each term in a block of
 *   rendered HTML as a `<button class="docsi-term">` carrying its tip, skipping
 *   code, links, headings, `<summary>` and other interactive or hidden text.
 * - `inlineCodeHtml` escapes a plain-text field (a check question) and turns
 *   its `` `code` `` spans into `<code>`.
 * - `unusedGlossaryEntries` finds entries no step ever mentions.
 *
 * No imports beyond `escapeHtml` and no DOM, like `interactive.ts`.
 */
import { escapeHtml } from './interactive.js';

export interface GlossaryEntry {
  term: string;
  terms?: string[];
  tip: string;
  link?: string;
}

/** Page-wide state for the generated ids (`docsi-term-1`, …): one per page, shared by every block on it. */
export interface TermIds {
  prefix: string;
  next: number;
}

export function termIds(prefix = 'docsi-term'): TermIds {
  return { prefix, next: 1 };
}

/** Elements whose text never gets a term button. */
const SKIP_TAGS = new Set([
  'a',
  'button',
  'code',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'kbd',
  'label',
  'option',
  'pre',
  'samp',
  'script',
  'select',
  'style',
  'summary',
  'svg',
  'textarea',
  'title',
]);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const TOKEN_RE = /<!--[\s\S]*?-->|<!\w[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A term as it appears in HTML text: `&`, `<`, `>` encoded; any run of whitespace matches any whitespace. */
function termPattern(term: string): string {
  const encoded = term.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return encoded
    .split(/\s+/)
    .map(escapeRegExp)
    .join('\\s+');
}

export interface CompiledGlossaryEntry {
  entry: GlossaryEntry;
  re: RegExp;
}

/** One case-insensitive whole-word regex per entry (term and aliases, longest first). */
export function compileGlossary(entries: readonly GlossaryEntry[]): CompiledGlossaryEntry[] {
  return entries.map((entry) => {
    const words = [entry.term, ...(entry.terms ?? [])].filter((w) => w.trim() !== '').sort((a, b) => b.length - a.length);
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${words.map(termPattern).join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
    return { entry, re };
  });
}

/** The button (and its visually hidden description) for one occurrence. */
export function termButton(text: string, entry: GlossaryEntry, id: string): string {
  const tip = escapeHtml(entry.tip);
  const link = entry.link !== undefined ? ` data-link="${escapeHtml(entry.link)}"` : '';
  return `<button type="button" class="docsi-term" aria-describedby="${id}" data-tip="${tip}"${link} title="${tip}">${text}</button><span class="docsi-term-tip" id="${id}">${tip}</span>`;
}

function linkText(text: string, compiled: readonly CompiledGlossaryEntry[], used: Set<GlossaryEntry>, ids: TermIds): string {
  let out = '';
  let rest = text;
  for (;;) {
    let best: { index: number; length: number; entry: GlossaryEntry } | undefined;
    for (const { entry, re } of compiled) {
      if (used.has(entry)) continue;
      const m = re.exec(rest);
      if (m && (best === undefined || m.index < best.index || (m.index === best.index && m[0].length > best.length))) {
        best = { index: m.index, length: m[0].length, entry };
      }
    }
    if (!best) return out + rest;
    used.add(best.entry);
    const id = `${ids.prefix}-${ids.next++}`;
    out += rest.slice(0, best.index) + termButton(rest.slice(best.index, best.index + best.length), best.entry, id);
    rest = rest.slice(best.index + best.length);
  }
}

/**
 * Wrap the first occurrence of each glossary term in `html` (one block: a
 * step body, one check, one receipt) as a term button. Text inside code,
 * links, headings, `<summary>`, buttons, labels, SVG, and any element marked
 * `aria-hidden="true"` or of class `docsi-when-label` is left alone. `ids`
 * numbers the buttons' descriptions across the page; pass the same `used`
 * set to several calls to make them one block. Returns `html` unchanged when
 * the glossary is empty.
 */
export function linkGlossaryTerms(
  html: string,
  entries: readonly GlossaryEntry[] | readonly CompiledGlossaryEntry[],
  ids: TermIds,
  used: Set<GlossaryEntry> = new Set(),
): string {
  if (entries.length === 0) return html;
  const compiled = 're' in entries[0]! ? (entries as readonly CompiledGlossaryEntry[]) : compileGlossary(entries as readonly GlossaryEntry[]);
  const stack: Array<{ tag: string; skip: boolean }> = [];
  let skipping = 0;
  let out = '';
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(html)) !== null) {
    const text = html.slice(last, m.index);
    out += skipping > 0 || text === '' ? text : linkText(text, compiled, used, ids);
    out += m[0];
    last = m.index + m[0].length;
    const [, closeTag, openTag, attrs = '', selfClosing] = m;
    if (closeTag !== undefined) {
      const tag = closeTag.toLowerCase();
      const at = stack.map((e) => e.tag).lastIndexOf(tag);
      if (at === -1) continue;
      for (const popped of stack.splice(at)) if (popped.skip) skipping--;
    } else if (openTag !== undefined) {
      const tag = openTag.toLowerCase();
      if (RAW_TEXT_TAGS.has(tag)) {
        const end = html.toLowerCase().indexOf(`</${tag}`, last);
        const stop = end === -1 ? html.length : end;
        out += html.slice(last, stop);
        last = stop;
        TOKEN_RE.lastIndex = stop;
        continue;
      }
      if (VOID_TAGS.has(tag) || selfClosing === '/') continue;
      const skip = SKIP_TAGS.has(tag) || /\saria-hidden\s*=\s*["']?true/i.test(attrs) || /\sclass\s*=\s*["'][^"']*\bdocsi-when-label\b/.test(attrs);
      stack.push({ tag, skip });
      if (skip) skipping++;
    }
  }
  const tail = html.slice(last);
  return out + (skipping > 0 || tail === '' ? tail : linkText(tail, compiled, used, ids));
}

/** Escape a plain-text field for HTML and render its `` `code` `` spans (the only Markdown it understands). */
export function inlineCodeHtml(text: string): string {
  return escapeHtml(text).replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

/** Entries whose term and aliases appear in none of `texts` (whole words, any case). */
export function unusedGlossaryEntries(entries: readonly GlossaryEntry[], texts: readonly string[]): GlossaryEntry[] {
  return compileGlossary(entries)
    .filter(({ re }) => !texts.some((text) => re.test(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))))
    .map(({ entry }) => entry);
}
