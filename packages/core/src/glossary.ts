/**
 * Glossary tooltips: the pure text work behind `docs/glossary.yaml`.
 *
 * - `linkGlossaryTerms` wraps the first occurrence of each term in a block of
 *   rendered HTML as a `<button class="docsi-term">` carrying its tip, skipping
 *   code, links, headings, `<summary>` and other interactive or hidden text.
 * - `inlineCodeHtml` escapes a plain-text field and turns its `` `code` ``
 *   spans into `<code>`; `inlineMarkdownHtml` also renders bold, emphasis and
 *   links (a check question or issue), never block elements.
 * - `unusedGlossaryEntries` finds entries no step ever mentions.
 *
 * No imports beyond `escapeHtml` and no DOM, like `interactive.ts`.
 */
import { escapeHtml, isSafeHref } from './interactive.js';

export interface GlossaryEntry {
  term: string;
  terms?: string[];
  tip: string;
  link?: string;
  /** Phrases (any case) in whose company the term is not matched: `mm OD` keeps `OD` out of a diameter. */
  exclude?: string[];
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
  /** `exclude` phrases, lower-cased. */
  exclude?: string[];
}

/** How far either side of a candidate match an `exclude` phrase is looked for. */
export const GLOSSARY_EXCLUDE_WINDOW = 12;

/** One case-insensitive whole-word regex per entry (term and aliases, longest first). */
export function compileGlossary(entries: readonly GlossaryEntry[]): CompiledGlossaryEntry[] {
  return entries.map((entry) => {
    const words = [entry.term, ...(entry.terms ?? [])].filter((w) => w.trim() !== '').sort((a, b) => b.length - a.length);
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${words.map(termPattern).join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
    const exclude = (entry.exclude ?? []).map((p) => p.trim().toLowerCase()).filter((p) => p !== '');
    return exclude.length > 0 ? { entry, re, exclude } : { entry, re };
  });
}

/** The button (and its visually hidden description) for one occurrence. */
export function termButton(text: string, entry: GlossaryEntry, id: string): string {
  const tip = escapeHtml(entry.tip);
  const link = entry.link !== undefined ? ` data-link="${escapeHtml(entry.link)}"` : '';
  return `<button type="button" class="docsi-term" aria-describedby="${id}" data-tip="${tip}"${link} title="${tip}">${text}</button><span class="docsi-term-tip" id="${id}">${tip}</span>`;
}

/** Decode the few entities `termPattern` encodes, so `exclude` phrases compare against the text a reader sees. */
function decodeText(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/**
 * The first occurrence of `compiled`'s term in `text` whose surroundings
 * ({@link GLOSSARY_EXCLUDE_WINDOW} characters each side, plus the match)
 * contain none of its `exclude` phrases.
 */
function findTerm(text: string, compiled: CompiledGlossaryEntry): { index: number; length: number } | undefined {
  const { re, exclude } = compiled;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (exclude !== undefined) {
      const start = Math.max(0, m.index - GLOSSARY_EXCLUDE_WINDOW);
      const around = decodeText(text.slice(start, m.index + m[0].length + GLOSSARY_EXCLUDE_WINDOW)).toLowerCase();
      if (exclude.some((p) => around.includes(p))) {
        re.lastIndex = m.index + Math.max(1, m[0].length);
        continue;
      }
    }
    return { index: m.index, length: m[0].length };
  }
  return undefined;
}

function linkText(text: string, compiled: readonly CompiledGlossaryEntry[], used: Set<GlossaryEntry>, ids: TermIds): string {
  let out = '';
  let rest = text;
  for (;;) {
    let best: { index: number; length: number; entry: GlossaryEntry } | undefined;
    for (const c of compiled) {
      if (used.has(c.entry)) continue;
      const m = findTerm(rest, c);
      if (m && (best === undefined || m.index < best.index || (m.index === best.index && m.length > best.length))) {
        best = { index: m.index, length: m.length, entry: c.entry };
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

/** Bold (`**x**`, `__x__`) and emphasis (`*x*`, `_x_`) in already-escaped text. */
function emphasisHtml(html: string): string {
  return html
    .replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![\p{L}\p{N}_])__(?=\S)([^_]*?\S)__(?![\p{L}\p{N}_])/gu, '<strong>$1</strong>')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>')
    .replace(/(?<![\p{L}\p{N}_])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}_])/gu, '<em>$1</em>');
}

/**
 * Inline-only Markdown for a plain-text field (a check question or issue):
 * `` `code` ``, `**bold**`, `*emphasis*` (or with underscores) and
 * `[text](url)` links, all escaped; nothing else is Markdown (no headings,
 * lists or paragraphs). A link with an unsafe URL (not http(s), mailto or
 * scheme-less) stays as its text.
 */
export function inlineMarkdownHtml(text: string): string {
  const held: string[] = [];
  const hold = (html: string) => `\u0000${held.push(html) - 1}\u0000`;
  let s = text.replace(/\u0000/g, '');
  s = s.replace(/`([^`\n]+)`/g, (_, code: string) => hold(`<code>${escapeHtml(code)}</code>`));
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
    const inner = emphasisHtml(escapeHtml(label)).replace(/\u0000(\d+)\u0000/g, (_m, i: string) => held[Number(i)]!);
    return hold(isSafeHref(href) ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner);
  });
  return emphasisHtml(escapeHtml(s)).replace(/\u0000(\d+)\u0000/g, (_m, i: string) => held[Number(i)]!);
}

/** Entries whose term and aliases appear in none of `texts` (whole words, any case). */
export function unusedGlossaryEntries(entries: readonly GlossaryEntry[], texts: readonly string[]): GlossaryEntry[] {
  return compileGlossary(entries)
    .filter((c) => !texts.some((text) => findTerm(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), c) !== undefined))
    .map(({ entry }) => entry);
}
