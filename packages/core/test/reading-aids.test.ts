/**
 * task_022 — reading aids in core: the glossary schema and loader, the
 * glossary matcher, inline code in plain-text fields, human setup summaries
 * and condition labels (`short`, unit labels), and profile items scoped to
 * guides.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DocsiError,
  describeWhen,
  formatCount,
  inlineCodeHtml,
  itemsForGuide,
  linkGlossaryTerms,
  loadProject,
  parseConfig,
  parseGlossary,
  profileSummary,
  termIds,
  unusedGlossaryEntries,
  whenLabel,
  wrapWhenBlocks,
  type GlossaryEntry,
  type Problem,
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

const SEPTUM: GlossaryEntry = { term: 'septum', terms: ['septa'], tip: 'The silicone disc in the vial cap.' };
const VIAL: GlossaryEntry = { term: 'vial', tip: 'The glass culture vessel.', link: 'https://example.invalid/vial' };
const VIAL_CAP: GlossaryEntry = { term: 'vial cap', tip: 'The lid of the vial.' };

function link(html: string, entries: GlossaryEntry[] = [SEPTUM, VIAL]): string {
  return linkGlossaryTerms(html, entries, termIds());
}

function buttons(html: string): string[] {
  return [...html.matchAll(/<button [^>]*>([^<]*)<\/button>/g)].map((m) => m[1]!);
}

// ---------------------------------------------------------------------------
// Schema

describe('glossary schema', () => {
  it('parses a list with aliases and links', () => {
    const g = parseGlossary('- term: septum\n  terms: [septa]\n  tip: "Seals the port."\n  link: https://x.invalid/s\n- {term: vial, tip: "Glass."}\n', 'docs/glossary.yaml');
    expect(g).toEqual([
      { term: 'septum', terms: ['septa'], tip: 'Seals the port.', link: 'https://x.invalid/s' },
      { term: 'vial', tip: 'Glass.' },
    ]);
    expect(parseGlossary('', 'docs/glossary.yaml')).toEqual([]);
  });

  it('requires term and tip, caps the tip at 240 characters', () => {
    const found = problems(() => parseGlossary(`- {term: a}\n- {tip: b}\n- {term: c, tip: "${'x'.repeat(241)}"}\n- {term: d, tip: "${'x'.repeat(240)}"}\n`, 'docs/glossary.yaml'));
    expect(found.map((p) => p.path)).toEqual(['0.tip', '1.term', '2.tip']);
    expect(found.every((p) => p.code === 'schema' && p.file === 'docs/glossary.yaml')).toBe(true);
    expect(found[2]!.message).toContain('240');
  });

  it('rejects duplicate terms and aliases, case-insensitively', () => {
    const found = problems(() => parseGlossary('- {term: Septum, tip: a}\n- {term: septum, tip: b}\n- {term: cap, terms: [SEPTA, lid], tip: c}\n- {term: x, terms: [septa], tip: d}\n', 'g.yaml'));
    expect(found.map((p) => p.path)).toEqual(['1.term', '3.terms.0']);
    expect(found[0]!.message).toContain('duplicate glossary term');
  });

  it('must be a list', () => {
    expect(problems(() => parseGlossary('term: x\n', 'g.yaml'))[0]!.message).toContain('YAML list');
  });
});

// ---------------------------------------------------------------------------
// Matcher

describe('glossary matcher', () => {
  it('wraps only the first occurrence of each term', () => {
    const out = link('<p>Pierce the septum. The septum reseals.</p>');
    expect(buttons(out)).toEqual(['septum']);
    expect(out).toContain('reseals');
    expect(out.match(/septum/g)!.length).toBe(2);
  });

  it('matches whole words only', () => {
    expect(buttons(link('<p>Septums and vials and devial.</p>'))).toEqual([]);
    expect(buttons(link('<p>A vial-holder, then (vial).</p>'))).toEqual(['vial']);
  });

  it('is case-insensitive and keeps the text as written', () => {
    expect(buttons(link('<p>Check the SEPTUM.</p>'))).toEqual(['SEPTUM']);
  });

  it('matches aliases; an alias uses up its entry', () => {
    expect(buttons(link('<p>Both septa, then the septum.</p>'))).toEqual(['septa']);
  });

  it('prefers the longest term at a position', () => {
    expect(buttons(link('<p>Unscrew the vial cap.</p>', [VIAL, VIAL_CAP]))).toEqual(['vial cap']);
  });

  it('skips code, links, headings, summaries, buttons and labels', () => {
    const html =
      '<h2>The septum</h2><p><code>septum</code> <a href="#">septum</a></p><details><summary>septum</summary><p>Inside: septum.</p></details><label>vial</label><p>A vial.</p>';
    const out = link(html);
    expect(buttons(out)).toEqual(['septum', 'vial']);
    expect(out).toContain('<h2>The septum</h2>');
    expect(out).toContain('<code>septum</code>');
    expect(out).toContain('<summary>septum</summary>');
    expect(out).toContain('<p>Inside: <button');
  });

  it('skips aria-hidden text and preformatted blocks', () => {
    const out = link('<p aria-hidden="true">septum</p><pre><code>vial\nseptum</code></pre><p>septum vial</p>');
    expect(out.startsWith('<p aria-hidden="true">septum</p><pre><code>vial\nseptum</code></pre><p><button')).toBe(true);
  });

  it('button markup: type, class, describedby, tip, link, title; a visually hidden description', () => {
    const out = link('<p>One vial.</p>');
    expect(out).toBe(
      '<p>One <button type="button" class="docsi-term" aria-describedby="docsi-term-1" data-tip="The glass culture vessel." data-link="https://example.invalid/vial" title="The glass culture vessel.">vial</button><span class="docsi-term-tip" id="docsi-term-1">The glass culture vessel.</span>.</p>',
    );
  });

  it('ids run across blocks of one page; each block has its own first occurrence', () => {
    const ids = termIds();
    const a = linkGlossaryTerms('<p>septum</p>', [SEPTUM], ids);
    const b = linkGlossaryTerms('<p>septum</p>', [SEPTUM], ids);
    expect(a).toContain('id="docsi-term-1"');
    expect(b).toContain('id="docsi-term-2"');
  });

  it('escapes tips and leaves attributes and comments alone', () => {
    const out = linkGlossaryTerms('<!-- septum --><p title="septum">x septum</p>', [{ term: 'septum', tip: 'A "disc" <b>' }], termIds());
    expect(out).toContain('<!-- septum --><p title="septum">x <button');
    expect(out).toContain('data-tip="A &quot;disc&quot; &lt;b&gt;"');
  });

  it('an empty glossary returns the html unchanged', () => {
    expect(linkGlossaryTerms('<p>septum</p>', [], termIds())).toBe('<p>septum</p>');
  });

  it('finds unused entries in raw step text', () => {
    expect(unusedGlossaryEntries([SEPTUM, VIAL], ['Pierce both SEPTA.'])).toEqual([VIAL]);
  });
});

describe('inline code in plain-text fields', () => {
  it('escapes and renders `code`', () => {
    expect(inlineCodeHtml('Is `config.ini` <valid>?')).toBe('Is <code>config.ini</code> &lt;valid&gt;?');
    expect(inlineCodeHtml('a ` lone tick')).toBe('a ` lone tick');
  });

  it('terms inside the code are not wrapped', () => {
    const out = linkGlossaryTerms(inlineCodeHtml('Does `vial` list the vial?'), [VIAL], termIds());
    expect(out).toContain('<code>vial</code> list the <button');
  });
});

// ---------------------------------------------------------------------------
// Summary and labels

const CONFIG = `guides:
  - {id: aep, title: "AEP", base: /aep}
  - {id: kit, title: "Kit", base: /kit}
profile:
  - {id: units, type: number, label: "How many Pioreactors?", unit_label: Pioreactor, unit_label_plural: Pioreactors, default: 1}
  - {id: temp-kit, type: boolean, label: "Do you have the temperature kit?", short: "temperature kit"}
  - {id: stirrer, type: boolean, label: "Stirrer fitted?"}
  - {id: count, type: number, label: "Count"}
  - id: supplier
    type: choice
    label: "Supplier?"
    guides: [kit]
    options:
      - {value: a, label: "[Shop A](https://a.invalid) kit"}
      - {value: b, label: "Shop B"}
`;

describe('setup summary and condition labels', () => {
  const items = parseConfig(CONFIG).profile;

  it('keeps the new fields on the item', () => {
    expect(items[0]).toMatchObject({ unit_label: 'Pioreactor', unit_label_plural: 'Pioreactors' });
    expect(items[1]).toMatchObject({ short: 'temperature kit' });
    expect(items[4]).toMatchObject({ guides: ['kit'] });
  });

  it('summary: labels, not ids', () => {
    expect(profileSummary(items, { units: 3, 'temp-kit': true, stirrer: false, count: 1, supplier: 'a' })).toBe(
      '3 Pioreactors · temperature kit: yes · Stirrer fitted?: no · 1 count · Shop A kit',
    );
    expect(profileSummary(items.slice(0, 1), { units: 1 })).toBe('1 Pioreactor');
  });

  it('formatCount falls back to the id', () => {
    expect(formatCount({ id: 'units' }, 2)).toBe('2 units');
    expect(formatCount({ id: 'units', unit_label: 'unit' }, 2)).toBe('2 unit');
  });

  it('Only with / without the short label', () => {
    expect(whenLabel({ 'temp-kit': true }, items)).toBe('Only with temperature kit');
    expect(whenLabel({ 'temp-kit': false }, items)).toBe('Only without temperature kit');
    expect(whenLabel({ stirrer: true }, items)).toBe('Only if: stirrer: yes');
    expect(whenLabel({ units: '>=2' }, items)).toBe('Only if: ≥ 2 Pioreactors');
    expect(describeWhen({ units: 3, count: '>=2' }, items)).toBe('3 Pioreactors and count ≥ 2');
    expect(describeWhen({ 'temp-kit': true, supplier: ['a', 'b'] }, items)).toBe('with temperature kit and supplier: Shop A kit or Shop B');
  });

  it('body when blocks use the same labels', () => {
    expect(wrapWhenBlocks('<!-- when temp-kit=true -->\nx\n<!-- /when -->', items).markdown).toContain('<p class="docsi-when-label">Only with temperature kit</p>');
  });

  it('unit labels are only for numbers', () => {
    const found = problems(() => parseConfig(`guides:\n  - {id: g, title: G, base: /g}\nprofile:\n  - {id: x, type: boolean, label: X, unit_label: u}\n`));
    expect(found.map((p) => p.path)).toEqual(['profile.0.unit_label']);
  });
});

// ---------------------------------------------------------------------------
// Profile items scoped to guides

describe('profile items scoped to guides', () => {
  const items = parseConfig(CONFIG).profile;

  it('itemsForGuide keeps unscoped items and those listing the guide', () => {
    expect(itemsForGuide(items, 'aep').map((i) => i.id)).toEqual(['units', 'temp-kit', 'stirrer', 'count']);
    expect(itemsForGuide(items, 'kit').map((i) => i.id)).toEqual(['units', 'temp-kit', 'stirrer', 'count', 'supplier']);
  });

  it('guides must be declared', () => {
    const found = problems(() => parseConfig(`guides:\n  - {id: g, title: G, base: /g}\nprofile:\n  - {id: x, type: boolean, label: X, guides: [g, nope]}\n`));
    expect(found.map((p) => p.path)).toEqual(['profile.0.guides.1']);
  });
});

// ---------------------------------------------------------------------------
// Loader

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'docsi-reading-'));
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const step = (id: string, guide: string, extra = '', body = 'Text.') => `---\nid: ${id}\norder: 1\ntitle: ${id}\nguide: ${guide}\n${extra}---\n${body}\n`;

describe('loader', () => {
  it('loads docs/glossary.yaml and warns about entries no step uses', () => {
    const root = project({
      'docsandeye.config.yaml': CONFIG,
      'docs/glossary.yaml': '- {term: septum, tip: "Seal."}\n- {term: vial, tip: "Glass."}\n- {term: lid, tip: "Top."}\n',
      'docs/steps/s1.md': step('s1', 'aep', 'checks:\n  - {id: c, question: "Is the lid on?"}\n', 'Pierce the Septum.'),
    });
    const model = loadProject(root);
    expect(model.problems).toEqual([]);
    expect(model.glossary!.map((e) => e.term)).toEqual(['septum', 'vial', 'lid']);
    expect(model.warnings).toEqual([{ code: 'schema', file: 'docs/glossary.yaml', path: '1.term', message: 'glossary term "vial" never appears in any step' }]);
  });

  it('an invalid glossary is a problem; no glossary is an empty one', () => {
    const bad = loadProject(project({ 'docsandeye.config.yaml': CONFIG, 'docs/glossary.yaml': '- {term: x}\n' }));
    expect(bad.problems.map((p) => `${p.file}:${p.path}`)).toEqual(['docs/glossary.yaml:0.tip']);
    expect(bad.glossary).toEqual([]);
    expect(loadProject(project({ 'docsandeye.config.yaml': CONFIG })).glossary).toEqual([]);
  });

  it('a when naming an item outside the step\'s guide is a schema problem', () => {
    const root = project({
      'docsandeye.config.yaml': CONFIG,
      'docs/steps/s1.md': step('s1', 'aep', 'when: {supplier: a}\n'),
      'docs/steps/s2.md': step('s2', 'kit', 'when: {supplier: a}\n'),
    });
    const found = loadProject(root).problems;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: 'schema', file: 'docs/steps/s1.md', path: 'when.supplier' });
    expect(found[0]!.message).toContain('does not apply to guide "aep"');
  });

  it('a body when block naming an item outside the guide is a body problem', () => {
    const root = project({
      'docsandeye.config.yaml': CONFIG,
      'docs/steps/s1.md': step('s1', 'aep', '', '<!-- when supplier=a -->\nx\n<!-- /when -->'),
    });
    expect(loadProject(root).bodyProblems!.map((p) => p.message)).toEqual([expect.stringContaining('unknown profile id "supplier"')]);
  });
});
