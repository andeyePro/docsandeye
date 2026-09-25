/**
 * task_023 — review follow-ups in core: glossary `exclude`, draft receipt
 * notes, inline Markdown in check questions and issues, and a guide's
 * companion `pages`.
 */
import { describe, expect, it } from 'vitest';
import {
  DocsiError,
  inlineMarkdownHtml,
  isDraftNote,
  linkGlossaryTerms,
  parseConfig,
  parseGlossary,
  receiptItems,
  termIds,
  unusedGlossaryEntries,
  type GlossaryEntry,
  type Problem,
  type ProjectModel,
} from '../src/index.js';

function problems(fn: () => unknown): Problem[] {
  try {
    fn();
    return [];
  } catch (err) {
    if (err instanceof DocsiError) return err.problems;
    throw err;
  }
}

function buttons(html: string): string[] {
  return [...html.matchAll(/<button [^>]*>([^<]*)<\/button>/g)].map((m) => m[1]!);
}

// ---------------------------------------------------------------------------
// Glossary exclude

const OD: GlossaryEntry = { term: 'OD', tip: 'Optical density.', exclude: ['mm OD', 'OD,'] };

describe('glossary exclude', () => {
  const link = (html: string, entries: GlossaryEntry[] = [OD]) => linkGlossaryTerms(html, entries, termIds());

  it('skips an occurrence inside an excluded phrase and links the next one', () => {
    const out = link('<p>Use 12 mm OD tubing, then read the OD.</p>');
    expect(buttons(out)).toEqual(['OD']);
    expect(out).toContain('12 mm OD tubing, then read the <button');
  });

  it('phrases match in any case, and the window reaches 12 characters either side', () => {
    expect(buttons(link('<p>A 6 MM od tube.</p>'))).toEqual([]);
    expect(buttons(link('<p>OD, then more.</p>'))).toEqual([]);
    // The phrase must lie within 12 characters of the match (here after it).
    const tubing: GlossaryEntry = { term: 'OD', tip: 'Optical density.', exclude: ['tubing'] };
    expect(buttons(link('<p>OD 1234 tubing</p>', [tubing]))).toEqual([]);
    expect(buttons(link('<p>OD 123456789 tubing</p>', [tubing]))).toEqual(['OD']);
    expect(buttons(link('<p>tubing 1234 OD</p>', [tubing]))).toEqual([]);
    expect(buttons(link('<p>tubing 123456789 OD</p>', [tubing]))).toEqual(['OD']);
  });

  it('without a later occurrence nothing is linked; other entries are unaffected', () => {
    const vial: GlossaryEntry = { term: 'vial', tip: 'Glass.' };
    expect(buttons(link('<p>The vial takes 25 mm OD tubing.</p>', [OD, vial]))).toEqual(['vial']);
  });

  it('an entry used only inside excluded phrases counts as unused', () => {
    expect(unusedGlossaryEntries([OD], ['12 mm OD tube'])).toEqual([OD]);
    expect(unusedGlossaryEntries([OD], ['12 mm OD tube; measure OD later'])).toEqual([]);
  });

  it('the schema accepts an optional list of non-empty strings', () => {
    expect(parseGlossary('- {term: OD, tip: "Optical density.", exclude: ["mm OD", "OD,"]}\n', 'g.yaml')).toEqual([OD]);
    const found = problems(() => parseGlossary('- {term: a, tip: b, exclude: [""]}\n- {term: c, tip: d, exclude: x}\n', 'g.yaml'));
    expect(found.map((p) => p.path)).toEqual(['0.exclude.0', '1.exclude']);
  });
});

// ---------------------------------------------------------------------------
// Draft receipt notes

describe('draft receipt notes', () => {
  it('isDraftNote: starts with DRAFT:, any case', () => {
    expect(isDraftNote('DRAFT: check the count')).toBe(true);
    expect(isDraftNote('  draft: x')).toBe(true);
    expect(isDraftNote('Draft:x')).toBe(true);
    expect(isDraftNote('A draft: not at the start')).toBe(false);
    expect(isDraftNote('DRAFT without a colon')).toBe(false);
  });

  const model = {
    config: { guides: [{ id: 'g', title: 'G', base: '/g' }] },
    steps: new Map(),
    components: new Map([
      ['a', { id: 'a', name: 'A', receipt: { per: 'unit', qty: 1, note: 'DRAFT: to confirm' } }],
      ['b', { id: 'b', name: 'B', receipt: { per: 'kit', qty: 1, note: 'Bag B' } }],
    ]),
  } as unknown as ProjectModel;

  it('receiptItems drops DRAFT notes for readers (the default) and keeps them for maintainers', () => {
    expect(receiptItems(model, 'g').map((i) => i.note)).toEqual([undefined, 'Bag B']);
    expect(receiptItems(model, 'g', { maintainer: false }).map((i) => i.note)).toEqual([undefined, 'Bag B']);
    expect(receiptItems(model, 'g', { maintainer: true }).map((i) => i.note)).toEqual(['DRAFT: to confirm', 'Bag B']);
  });
});

// ---------------------------------------------------------------------------
// Inline Markdown

describe('inline Markdown in check questions and issues', () => {
  it('renders code, bold, emphasis and links', () => {
    expect(inlineMarkdownHtml('Is `a.ini` **tight** and *dry*?')).toBe('Is <code>a.ini</code> <strong>tight</strong> and <em>dry</em>?');
    expect(inlineMarkdownHtml('__Bold__ and _em_')).toBe('<strong>Bold</strong> and <em>em</em>');
    expect(inlineMarkdownHtml('See [the table](https://x.example/t?a=1&b=2).')).toBe('See <a href="https://x.example/t?a=1&amp;b=2">the table</a>.');
    expect(inlineMarkdownHtml('[**bold** `code`](/p/)')).toBe('<a href="/p/"><strong>bold</strong> <code>code</code></a>');
  });

  it('escapes everything else and renders no block elements', () => {
    expect(inlineMarkdownHtml('# Not a heading\n- not a list <b>x</b> & y')).toBe('# Not a heading\n- not a list &lt;b&gt;x&lt;/b&gt; &amp; y');
    expect(inlineMarkdownHtml('> quote')).toBe('&gt; quote');
  });

  it('code spans are literal; snake_case and lone asterisks stay text', () => {
    expect(inlineMarkdownHtml('`**x**` and `<a>`')).toBe('<code>**x**</code> and <code>&lt;a&gt;</code>');
    expect(inlineMarkdownHtml('set max_od_value to 2 * 3 * 4')).toBe('set max_od_value to 2 * 3 * 4');
  });

  it('an unsafe link stays as its text', () => {
    expect(inlineMarkdownHtml('[click](javascript:alert(1))')).not.toContain('<a');
    expect(inlineMarkdownHtml('[mail](mailto:a@b.example)')).toBe('<a href="mailto:a@b.example">mail</a>');
  });
});

// ---------------------------------------------------------------------------
// Companion pages

describe('guide pages', () => {
  const config = (pages: string) => parseConfig(`guides:\n  - {id: aep, title: AEP, base: /AEP, pages: ${pages}}\n`);

  it('parses label and slug, trimming slashes', () => {
    expect(config('[{label: Protocol, slug: /aep/protocol/}]').guides[0]!.pages).toEqual([{ label: 'Protocol', slug: 'aep/protocol' }]);
    expect(parseConfig('guides:\n  - {id: aep, title: AEP, base: /AEP}\n').guides[0]!.pages).toBeUndefined();
  });

  it('requires both fields, non-empty', () => {
    const found = problems(() => config('[{label: P}, {label: "", slug: x}, {label: Q, slug: "/"}]'));
    expect(found.map((p) => p.path)).toEqual(['guides.0.pages.0.slug', 'guides.0.pages.1.label', 'guides.0.pages.2.slug']);
  });
});
