/**
 * Page descriptions for `<meta name="description">` and the OpenGraph and
 * Twitter tags Starlight derives from a page's `description` frontmatter.
 * Pure: a step's description is the first prose paragraph of its Markdown
 * body, reduced to plain text and cut at a word boundary.
 */

/** Longest description a search result shows in full. */
export const DESCRIPTION_MAX = 155;

const ELLIPSIS = '…';

/** A block that is not a prose paragraph: heading, fence, directive, HTML, table, quote, list, rule. */
const NON_PARAGRAPH = /^(#{1,6}(\s|$)|```|~~~|:::|<|\||>|[-*+]\s|\d+[.)]\s|(-\s*){3,}$|(\*\s*){3,}$|(_\s*){3,}$)/;

/** A line holding only an image (a figure, not prose). */
const IMAGE_ONLY = /^!\[[^\]]*\]\([^)]*\)$/;

/**
 * The paragraphs of a Markdown body that a reader always sees: HTML comments
 * dropped, the contents of `<!-- when … -->` blocks (shown only for some
 * readers) and of fences and `:::` directives skipped.
 */
function alwaysShownParagraphs(body: string): string[] {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const paragraphs: string[] = [];
  let current: string[] = [];
  let whenDepth = 0;
  let fence: string | undefined;
  let directiveDepth = 0;
  let inComment = false;
  const flush = () => {
    if (current.length > 0) paragraphs.push(current.join('\n'));
    current = [];
  };
  for (const rawLine of lines) {
    let line = rawLine;
    if (fence !== undefined) {
      if (line.trim().startsWith(fence)) fence = undefined;
      continue;
    }
    if (inComment) {
      const end = line.indexOf('-->');
      if (end < 0) continue;
      inComment = false;
      line = line.slice(end + 3);
    }
    const trimmed = line.trim();
    if (/^<!--\s*when\b.*-->$/.test(trimmed)) {
      flush();
      whenDepth += 1;
      continue;
    }
    if (/^<!--\s*\/when\s*-->$/.test(trimmed)) {
      flush();
      whenDepth = Math.max(0, whenDepth - 1);
      continue;
    }
    // Other comments are removed; one left open runs to its `-->`.
    line = line.replace(/<!--[\s\S]*?-->/g, '');
    const open = line.indexOf('<!--');
    if (open >= 0) {
      inComment = true;
      line = line.slice(0, open);
    }
    const text = line.trim();
    if (whenDepth > 0) continue;
    const fenceMatch = /^(```|~~~)/.exec(text);
    if (fenceMatch) {
      flush();
      fence = fenceMatch[1];
      continue;
    }
    if (text.startsWith(':::')) {
      flush();
      if (/^:::+\s*$/.test(text)) directiveDepth = Math.max(0, directiveDepth - 1);
      else directiveDepth += 1;
      continue;
    }
    if (directiveDepth > 0) continue;
    if (text === '') {
      // A line that was only a comment does not end a paragraph.
      if (rawLine.trim() === '' || current.length === 0) flush();
      continue;
    }
    current.push(text);
  }
  flush();
  return paragraphs.filter((p) => !NON_PARAGRAPH.test(p) && !IMAGE_ONLY.test(p));
}

/** Inline Markdown to plain text: links and emphasis keep their words; images, HTML tags and code marks go. */
export function plainText(markdown: string): string {
  return (
    markdown
      // Images carry no prose.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '')
      // Links: inline, reference and autolinks.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')
      // Text directives (`:kbd[Ctrl]{…}`) keep their label.
      .replace(/(^|[\s(]):[a-zA-Z][\w-]*\[([^\]]*)\](\{[^}]*\})?/g, '$1$2')
      // Inline HTML tags.
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      // Code spans keep their text.
      .replace(/`+([^`]*)`+/g, '$1')
      // Emphasis and strikethrough (not intra-word underscores).
      .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
      .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*/g, '$1$2')
      .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?![\w])/g, '$1$2')
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
      // Hard breaks and backslash escapes.
      .replace(/\\\n/g, ' ')
      .replace(/\\([\\`*_{}[\]()#+\-.!<>~|])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * `text` cut to at most `max` characters: whole when it fits, else at the
 * last word boundary with an ellipsis (trailing punctuation dropped before
 * it). A single word longer than `max` is cut mid-word.
 */
export function truncateAtWord(text: string, max = DESCRIPTION_MAX): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max - ELLIPSIS.length + 1);
  const space = room.lastIndexOf(' ');
  const cut = space > 0 ? room.slice(0, space) : room.slice(0, max - ELLIPSIS.length);
  return `${cut.replace(/[\s,;:.!?—–-]+$/, '')}${ELLIPSIS}`;
}

/**
 * A step page's description: its first always-shown prose paragraph with the
 * Markdown stripped, at most `max` characters; undefined when the body has
 * none (Starlight then uses the site description).
 */
export function stepDescription(body: string, max = DESCRIPTION_MAX): string | undefined {
  for (const paragraph of alwaysShownParagraphs(body)) {
    const text = plainText(paragraph);
    if (text !== '') return truncateAtWord(text, max);
  }
  return undefined;
}

/** A guide index page's description: `<title>: <N> steps.` (`1 step.` for one). */
export function guideDescription(title: string, stepCount: number): string {
  return `${title}: ${stepCount} ${stepCount === 1 ? 'step' : 'steps'}.`;
}
