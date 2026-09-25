/**
 * Draft markers left in a built site: reader-visible text on a guide or step
 * page that contains `<!-- TODO` (a comment the author escaped or put in code,
 * so the renderer printed it instead of stripping it) or the word `DRAFT:`
 * anywhere in a line. `docsandeye check --dist` reports each as an error. Only text
 * counts: attributes, `<script>`/`<style>` bodies and HTML comments are not
 * shown to a reader.
 */
import fs from 'node:fs';
import { parse, NodeType, type HTMLElement, type Node } from 'node-html-parser';
import { findIndexPages, pagePath, STEP_META_NAME } from './budget.js';

export const GUIDE_META_NAME = 'docsandeye:guide';

const TODO_MARK = '<!-- TODO';
const DRAFT_MARK = /\bDRAFT:/;

/** Parse with `<pre>` (and `<noscript>`) as ordinary markup; the parser's default keeps them as raw text. */
const PARSE_OPTIONS = { comment: false, blockTextElements: { script: true, style: true } };

/** Elements whose text a reader never sees. */
const HIDDEN = new Set(['script', 'style']);

/** Elements that start a new line of text. */
const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'caption', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'legend', 'li', 'main', 'nav', 'ol', 'option', 'p', 'pre',
  'section', 'summary', 'table', 'td', 'th', 'title', 'tr', 'ul',
]);

/** The reader-visible text of `root`, one line per block element (and per newline inside one). */
export function visibleLines(root: Node): string[] {
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === NodeType.TEXT_NODE) {
      parts.push(node.text);
      return;
    }
    if (node.nodeType !== NodeType.ELEMENT_NODE) return;
    const tag = (node as HTMLElement).rawTagName?.toLowerCase() ?? '';
    if (HIDDEN.has(tag)) return;
    const block = BLOCK.has(tag);
    if (block) parts.push('\n');
    for (const child of node.childNodes) walk(child);
    if (block) parts.push('\n');
  };
  walk(root);
  return parts
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '');
}

/** At most 60 characters of `line` from `at`, for an error message. */
function excerpt(line: string, at: number): string {
  const text = line.slice(at);
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

/** Draft-marker findings in one page (HTML or a parsed root), as messages without the page prefix. */
export function draftMarkers(page: string | HTMLElement): string[] {
  const root = typeof page === 'string' ? parse(page, PARSE_OPTIONS) : page;
  const found: string[] = [];
  for (const line of visibleLines(root)) {
    const todo = line.indexOf(TODO_MARK);
    if (todo >= 0) found.push(`contains "${TODO_MARK}": ${excerpt(line, todo)}`);
    const draft = line.search(DRAFT_MARK);
    if (draft >= 0) found.push(`contains "DRAFT:": ${excerpt(line, draft)}`);
  }
  return found;
}

/** `draft: <page> …` error lines for every guide and step page under `dir`. */
export function draftErrors(dir: string): string[] {
  const errors: string[] = [];
  for (const htmlPath of findIndexPages(dir)) {
    const root = parse(fs.readFileSync(htmlPath, 'utf8'), PARSE_OPTIONS);
    if (!root.querySelector(`meta[name="${STEP_META_NAME}"], meta[name="${GUIDE_META_NAME}"]`)) continue;
    const page = pagePath(dir, htmlPath);
    for (const message of draftMarkers(root)) errors.push(`draft: ${page} ${message}`);
  }
  return errors;
}
