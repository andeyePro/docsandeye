/**
 * task_020 — reader-interactive guides: config/component/step/media schema
 * fields, `matchesWhen`, the body `when` comment parser, receipt aggregation,
 * the mailto builders and the loader's cross-checks against the profile.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DocsiError,
  buildMediaPlan,
  buildReceipt,
  checkMailto,
  checksComplete,
  computeReceipt,
  defaultProfile,
  describeWhen,
  loadProject,
  matchesWhen,
  missingParts,
  missingPartsMailto,
  nextApplicableStep,
  normaliseProfile,
  parseComponent,
  parseConfig,
  parseMedia,
  parseStep,
  parseStoredProfile,
  parseWhenComment,
  profileSummary,
  receiptItems,
  wrapWhenBlocks,
  youtubeEmbedUrl,
  youtubeWatchUrl,
  type Problem,
  type ProfileItem,
  type ReceiptItem,
} from '../src/index.js';
import { buildExportPlan } from '../src/export-plan.js';

// ---------------------------------------------------------------------------
// Helpers

const PROFILE_YAML = `profile:
  - id: units
    type: number
    label: "How many units?"
    default: 1
    min: 1
    max: 50
  - id: temp-kit
    type: boolean
    label: "Do you have the temperature kit?"
    default: false
  - id: supplier
    type: choice
    label: "Where did your parts come from?"
    options:
      - {value: shop-a, label: "Shop A kit"}
      - {value: shop-b, label: "Shop B"}
      - {value: diy, label: "Sourced myself"}
    default: shop-a
receipt:
  multiply_by: units
  supplier_from: supplier
contacts:
  shop-a: {name: "Shop A", email: "help@shop-a.invalid", subject: "Missing parts: kit"}
  shop-b: {name: "Shop B"}
  project: {name: "Project", email: "project@example.invalid", subject: "Guide help"}
`;

const BASE_CONFIG = `guides:\n  - {id: g, title: "Guide", base: /g}\n`;

function configProblems(yaml: string): Problem[] {
  try {
    parseConfig(yaml);
    return [];
  } catch (err) {
    if (err instanceof DocsiError) return err.problems;
    throw err;
  }
}

function problemsOf(fn: () => unknown): Problem[] {
  try {
    fn();
    return [];
  } catch (err) {
    if (err instanceof DocsiError) return err.problems;
    throw err;
  }
}

const ITEMS: ProfileItem[] = parseConfig(BASE_CONFIG + PROFILE_YAML).profile;

// ---------------------------------------------------------------------------
// Config schema

describe('config: profile, receipt, contacts', () => {
  it('parses the full example and fills defaults', () => {
    const config = parseConfig(BASE_CONFIG + PROFILE_YAML);
    expect(config.profile.map((p) => p.id)).toEqual(['units', 'temp-kit', 'supplier']);
    expect(config.profile[0]).toMatchObject({ type: 'number', default: 1, min: 1, max: 50 });
    expect(config.profile[2]!.options).toHaveLength(3);
    expect(config.receipt).toEqual({ multiply_by: 'units', supplier_from: 'supplier' });
    expect(config.contacts['shop-a']!.email).toBe('help@shop-a.invalid');
    expect(config.contacts['shop-b']!.email).toBeUndefined();
  });

  it('existing configs parse unchanged, with empty profile and contacts', () => {
    const config = parseConfig(BASE_CONFIG);
    expect(config.profile).toEqual([]);
    expect(config.contacts).toEqual({});
    expect(config.receipt).toBeUndefined();
  });

  it('defaults: number → min (1..100), boolean → false, choice → first option', () => {
    const config = parseConfig(
      `${BASE_CONFIG}profile:\n  - {id: n, type: number, label: N}\n  - {id: b, type: boolean, label: B}\n  - {id: c, type: choice, label: C, options: [{value: x, label: X}, {value: y, label: Y}]}\n`,
    );
    expect(config.profile[0]).toMatchObject({ default: 1, min: 1, max: 100 });
    expect(config.profile[1]).toMatchObject({ default: false });
    expect(config.profile[2]).toMatchObject({ default: 'x' });
  });

  const invalid: Array<[string, string, string]> = [
    ['duplicate profile id', `profile:\n  - {id: a, type: boolean, label: A}\n  - {id: a, type: boolean, label: A2}\n`, 'profile.1.id'],
    ['non-kebab profile id', `profile:\n  - {id: Units, type: number, label: U}\n`, 'profile.0.id'],
    ['unknown type', `profile:\n  - {id: a, type: text, label: A}\n`, 'profile.0.type'],
    ['choice without options', `profile:\n  - {id: a, type: choice, label: A}\n`, 'profile.0.options'],
    ['choice with empty options', `profile:\n  - {id: a, type: choice, label: A, options: []}\n`, 'profile.0.options'],
    ['options on a boolean', `profile:\n  - {id: a, type: boolean, label: A, options: [{value: x, label: X}]}\n`, 'profile.0.options'],
    ['options on a number', `profile:\n  - {id: a, type: number, label: A, options: [{value: x, label: X}]}\n`, 'profile.0.options'],
    ['number default not an integer', `profile:\n  - {id: a, type: number, label: A, default: 1.5}\n`, 'profile.0.default'],
    ['number default below min', `profile:\n  - {id: a, type: number, label: A, min: 2, default: 1}\n`, 'profile.0.default'],
    ['number default above max', `profile:\n  - {id: a, type: number, label: A, max: 3, default: 4}\n`, 'profile.0.default'],
    ['number default a string', `profile:\n  - {id: a, type: number, label: A, default: "2"}\n`, 'profile.0.default'],
    ['boolean default a string', `profile:\n  - {id: a, type: boolean, label: A, default: "yes"}\n`, 'profile.0.default'],
    ['choice default not an option', `profile:\n  - {id: a, type: choice, label: A, options: [{value: x, label: X}], default: y}\n`, 'profile.0.default'],
    ['min on a boolean', `profile:\n  - {id: a, type: boolean, label: A, min: 1}\n`, 'profile.0.min'],
    ['max below min', `profile:\n  - {id: a, type: number, label: A, min: 5, max: 2}\n`, 'profile.0.max'],
    ['multiply_by unknown', `profile:\n  - {id: a, type: number, label: A}\nreceipt: {multiply_by: nope}\n`, 'receipt.multiply_by'],
    ['multiply_by not a number item', `profile:\n  - {id: a, type: boolean, label: A}\nreceipt: {multiply_by: a}\n`, 'receipt.multiply_by'],
    ['supplier_from not a choice item', `profile:\n  - {id: a, type: number, label: A}\nreceipt: {supplier_from: a}\n`, 'receipt.supplier_from'],
    [
      'contacts key not an option',
      `profile:\n  - {id: s, type: choice, label: S, options: [{value: x, label: X}]}\nreceipt: {supplier_from: s}\ncontacts:\n  y: {name: Y, email: y@example.invalid}\n`,
      'contacts.y',
    ],
    ['contact email without @', `contacts:\n  project: {name: P, email: nobody}\n`, 'contacts.project.email'],
    ['contact without name', `contacts:\n  project: {email: a@b.invalid}\n`, 'contacts.project.name'],
  ];
  for (const [name, yaml, path] of invalid) {
    it(`rejects ${name} at ${path}`, () => {
      const problems = configProblems(BASE_CONFIG + yaml);
      expect(problems.map((p) => p.path)).toContain(path);
      expect(problems.every((p) => p.code === 'schema' && p.file === 'docsandeye.config.yaml')).toBe(true);
    });
  }

  it('allows a contact without email and a project contact without receipt config', () => {
    expect(configProblems(`${BASE_CONFIG}contacts:\n  project: {name: P}\n`)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Component, step and media schemas

const COMPONENT = `id: bolt\nname: Bolt\nkind: off-the-shelf\ndesign_version: 1.0.0\nmaster_format: none\n`;

describe('component receipt', () => {
  it('defaults per to unit and qty to 1', () => {
    const c = parseComponent(`${COMPONENT}receipt: {}\n`, 'bolt.yaml');
    expect(c.receipt).toEqual({ per: 'unit', qty: 1 });
  });

  it('parses per, qty, from, when, note', () => {
    const c = parseComponent(`${COMPONENT}receipt: {per: kit, qty: 2, from: [shop-a], when: {temp-kit: true}, note: "Bag B"}\n`, 'bolt.yaml');
    expect(c.receipt).toEqual({ per: 'kit', qty: 2, from: ['shop-a'], when: { 'temp-kit': true }, note: 'Bag B' });
  });

  for (const [name, yaml, path] of [
    ['bad per', 'receipt: {per: box}', 'receipt.per'],
    ['zero qty', 'receipt: {qty: 0}', 'receipt.qty'],
    ['non-integer qty', 'receipt: {qty: 1.5}', 'receipt.qty'],
    ['non-kebab from', 'receipt: {from: [Shop A]}', 'receipt.from.0'],
    ['when not a mapping', 'receipt: {when: [a]}', 'receipt.when'],
  ] as const) {
    it(`rejects ${name} at ${path}`, () => {
      expect(problemsOf(() => parseComponent(`${COMPONENT}${yaml}\n`, 'bolt.yaml')).map((p) => p.path)).toContain(path);
    });
  }
});

const STEP_HEAD = 'id: s1\norder: 1\ntitle: Step one\n';

describe('step fields', () => {
  it('parses when, receipt, profile, checks, checks_draft and part/tool when', () => {
    const step = parseStep(
      `---\n${STEP_HEAD}when: {temp-kit: true}\nreceipt: true\nprofile: true\nchecks_draft: true\nparts:\n  - {component: bolt, when: {units: ">=2"}}\ntools:\n  - {component: key, when: {supplier: [shop-a, shop-b]}}\nchecks:\n  - id: bubbles\n    question: "Bubbles?"\n    issues:\n      - {problem: "None", fix: "Check the lead"}\n    when: {temp-kit: false}\n---\nBody\n`,
      's1.md',
    );
    expect(step.when).toEqual({ 'temp-kit': true });
    expect(step.receipt).toBe(true);
    expect(step.profile).toBe(true);
    expect(step.checks_draft).toBe(true);
    expect(step.parts[0]!.when).toEqual({ units: '>=2' });
    expect(step.tools[0]!.when).toEqual({ supplier: ['shop-a', 'shop-b'] });
    expect(step.checks).toEqual([{ id: 'bubbles', question: 'Bubbles?', issues: [{ problem: 'None', fix: 'Check the lead' }], when: { 'temp-kit': false } }]);
  });

  it('checks issues default to an empty list', () => {
    const step = parseStep(`---\n${STEP_HEAD}checks:\n  - {id: a, question: "Q?"}\n---\n`, 's1.md');
    expect(step.checks![0]!.issues).toEqual([]);
  });

  for (const [name, yaml, path] of [
    ['duplicate check id', 'checks:\n  - {id: a, question: Q}\n  - {id: a, question: R}', 'checks.1.id'],
    ['non-kebab check id', 'checks:\n  - {id: A b, question: Q}', 'checks.0.id'],
    ['check without question', 'checks:\n  - {id: a}', 'checks.0.question'],
    ['issue without fix', 'checks:\n  - {id: a, question: Q, issues: [{problem: P}]}', 'checks.0.issues.0.fix'],
    ['receipt not boolean', 'receipt: yes-please', 'receipt'],
    ['when with an empty list', 'when: {units: []}', 'when.units'],
  ] as const) {
    it(`rejects ${name} at ${path}`, () => {
      expect(problemsOf(() => parseStep(`---\n${STEP_HEAD}${yaml}\n---\n`, 's1.md')).map((p) => p.path)).toContain(path);
    });
  }
});

const MEDIA_HEAD = 'id: v1\ntype: video\nshot_date: 2026-09-01\nshot_by: Me\nhero: [bolt@1.0.0]\n';

describe('media: youtube', () => {
  it('youtube makes file, poster and duration_s optional', () => {
    const m = parseMedia(`${MEDIA_HEAD}youtube: dQw4w9WgXcQ\nstart_s: 12\nend_s: 40\n`, 'v1.yaml');
    expect(m).toMatchObject({ youtube: 'dQw4w9WgXcQ', start_s: 12, end_s: 40 });
    expect(m.file).toBeUndefined();
  });

  it('a self-hosted video still needs file, poster and duration_s', () => {
    const paths = problemsOf(() => parseMedia(MEDIA_HEAD, 'v1.yaml')).map((p) => p.path);
    expect(paths).toEqual(expect.arrayContaining(['file', 'poster', 'duration_s']));
  });

  for (const [name, yaml, path] of [
    ['a 10-character id', 'youtube: abcdefghij', 'youtube'],
    ['an id with a bad character', 'youtube: abcdefghij!', 'youtube'],
    ['captions with youtube', 'youtube: dQw4w9WgXcQ\ncaptions: a.vtt', 'captions'],
    ['end_s not after start_s', 'youtube: dQw4w9WgXcQ\nstart_s: 10\nend_s: 10', 'end_s'],
    ['negative start_s', 'youtube: dQw4w9WgXcQ\nstart_s: -1', 'start_s'],
    ['non-integer end_s', 'youtube: dQw4w9WgXcQ\nend_s: 2.5', 'end_s'],
  ] as const) {
    it(`rejects ${name} at ${path}`, () => {
      expect(problemsOf(() => parseMedia(`${MEDIA_HEAD}${yaml}\n`, 'v1.yaml')).map((p) => p.path)).toContain(path);
    });
  }

  it('rejects youtube on a photo', () => {
    const text = 'id: p1\ntype: photo\nshot_date: 2026-09-01\nshot_by: Me\nhero: [bolt@1.0.0]\nyoutube: dQw4w9WgXcQ\n';
    expect(problemsOf(() => parseMedia(text, 'p1.yaml')).map((p) => p.path)).toContain('youtube');
  });

  it('watch and embed URLs', () => {
    expect(youtubeWatchUrl('dQw4w9WgXcQ', 12)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s');
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(youtubeEmbedUrl('dQw4w9WgXcQ', 12, 40)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&start=12&end=40&rel=0');
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
  });
});

// ---------------------------------------------------------------------------
// matchesWhen

describe('matchesWhen truth table', () => {
  const profile = { units: 2, 'temp-kit': true, supplier: 'shop-a' };
  const cases: Array<[string, Record<string, unknown> | undefined, boolean]> = [
    ['no condition', undefined, true],
    ['empty condition', {}, true],
    ['boolean match', { 'temp-kit': true }, true],
    ['boolean mismatch', { 'temp-kit': false }, false],
    ['number exact match', { units: 2 }, true],
    ['number exact mismatch', { units: 3 }, false],
    ['>= boundary', { units: '>=2' }, true],
    ['>= above', { units: '>=3' }, false],
    ['> strict', { units: '>2' }, false],
    ['> below', { units: '>1' }, true],
    ['< strict', { units: '<2' }, false],
    ['< above', { units: '<3' }, true],
    ['<= boundary', { units: '<=2' }, true],
    ['<= below', { units: '<=1' }, false],
    ['choice match', { supplier: 'shop-a' }, true],
    ['choice mismatch', { supplier: 'diy' }, false],
    ['list OR hit', { supplier: ['diy', 'shop-a'] }, true],
    ['list OR miss', { supplier: ['diy', 'shop-b'] }, false],
    ['number list OR', { units: [1, 2] }, true],
    ['comparator list OR', { units: ['<2', '>=5'] }, false],
    ['AND all match', { 'temp-kit': true, units: '>=2', supplier: 'shop-a' }, true],
    ['AND one fails', { 'temp-kit': true, units: '>=3' }, false],
    ['unknown key', { nope: true }, false],
    ['comparator string against a string value does not compare', { supplier: '>=1' }, false],
  ];
  for (const [name, when, expected] of cases) {
    it(`${name} → ${expected}`, () => {
      expect(matchesWhen(when as never, profile)).toBe(expected);
    });
  }
});

describe('describeWhen', () => {
  it('reads choice labels, yes/no and comparators', () => {
    expect(describeWhen({ 'temp-kit': true, supplier: ['shop-a', 'shop-b'], units: '>=2' }, ITEMS)).toBe(
      'temp-kit: yes and supplier: Shop A kit or Shop B and units ≥ 2',
    );
    expect(describeWhen({ units: 3 }, ITEMS)).toBe('units: 3');
  });
});

// ---------------------------------------------------------------------------
// Profile values

describe('profile values', () => {
  it('defaults and summary', () => {
    const p = defaultProfile(ITEMS);
    expect(p).toEqual({ units: 1, 'temp-kit': false, supplier: 'shop-a' });
    expect(profileSummary(ITEMS, { units: 2, 'temp-kit': true, supplier: 'shop-a' })).toBe('2 × units · temp-kit yes · Shop A kit');
  });

  it('normalises stored answers: clamps, rounds, drops unknowns, falls back to defaults', () => {
    expect(normaliseProfile(ITEMS, { units: 99, 'temp-kit': 'on', supplier: 'nope', extra: 1 })).toEqual({ units: 50, 'temp-kit': true, supplier: 'shop-a' });
    expect(normaliseProfile(ITEMS, { units: '3.4' })).toEqual({ units: 3, 'temp-kit': false, supplier: 'shop-a' });
    expect(normaliseProfile(ITEMS, { units: 0 })).toMatchObject({ units: 1 });
    expect(normaliseProfile(ITEMS, null)).toEqual(defaultProfile(ITEMS));
  });

  it('parseStoredProfile tolerates junk', () => {
    expect(parseStoredProfile(ITEMS, '{not json')).toEqual(defaultProfile(ITEMS));
    expect(parseStoredProfile(ITEMS, null)).toEqual(defaultProfile(ITEMS));
    expect(parseStoredProfile(ITEMS, '{"units":4,"supplier":"diy"}')).toEqual({ units: 4, 'temp-kit': false, supplier: 'diy' });
  });
});

// ---------------------------------------------------------------------------
// Body when comments

describe('body when comments', () => {
  it('parses a single condition, a list and a comparator; several are ANDed', () => {
    expect(parseWhenComment('temp-kit=true', ITEMS)).toEqual({ when: { 'temp-kit': true } });
    expect(parseWhenComment('supplier=shop-a,shop-b', ITEMS)).toEqual({ when: { supplier: ['shop-a', 'shop-b'] } });
    expect(parseWhenComment('units>=2', ITEMS)).toEqual({ when: { units: '>=2' } });
    expect(parseWhenComment('units=3', ITEMS)).toEqual({ when: { units: 3 } });
    expect(parseWhenComment('temp-kit=false units<2', ITEMS)).toEqual({ when: { 'temp-kit': false, units: '<2' } });
  });

  it('reports unknown ids and invalid values', () => {
    expect(parseWhenComment('nope=true', ITEMS).error).toMatch(/unknown profile id "nope"/);
    expect(parseWhenComment('temp-kit=maybe', ITEMS).error).toMatch(/boolean/);
    expect(parseWhenComment('supplier=shop-z', ITEMS).error).toMatch(/not an option/);
    expect(parseWhenComment('supplier>=2', ITEMS).error).toMatch(/not a number profile item/);
    expect(parseWhenComment('units=two', ITEMS).error).toMatch(/not a number/);
    expect(parseWhenComment('garbage', ITEMS).error).toMatch(/cannot read/);
  });

  it('wraps a block in a labelled div and keeps the Markdown between blank lines', () => {
    const body = 'Intro\n\n<!-- when temp-kit=true -->\nFit the **probe**.\n<!-- /when -->\n\nOutro\n';
    const { markdown, problems } = wrapWhenBlocks(body, ITEMS);
    expect(problems).toEqual([]);
    expect(markdown).toContain('<div class="docsi-when" data-when="{&quot;temp-kit&quot;:true}">');
    expect(markdown).toContain('<p class="docsi-when-label">Only if: temp-kit: yes</p>');
    expect(markdown).toMatch(/<\/p>\n\nFit the \*\*probe\*\*\.\n\n<\/div>/);
    expect(markdown).toContain('Intro');
    expect(markdown).toContain('Outro');
  });

  it('Markdown directly under <!-- /when --> (no blank line) is still Markdown: a blank line follows </div>', () => {
    const body = 'Intro\n<!-- when temp-kit=true -->\n**In**\n<!-- /when -->\n**After**\n';
    const { markdown, problems } = wrapWhenBlocks(body, ITEMS);
    expect(problems).toEqual([]);
    expect(markdown).toMatch(/<\/div>\n\n\*\*After\*\*/);
  });

  it('keeps the indentation of comments inside a list item', () => {
    const body = '1. one\n2. two\n\n   <!-- when temp-kit=true -->\n   **nested**\n   <!-- /when -->\n\n3. three\n';
    const { markdown } = wrapWhenBlocks(body, ITEMS);
    expect(markdown).toContain('\n   <div class="docsi-when"');
    expect(markdown).toContain('\n   <p class="docsi-when-label">');
    expect(markdown).toContain('\n   </div>\n');
  });

  it('labels choice and comparator conditions in words', () => {
    const { markdown } = wrapWhenBlocks('<!-- when supplier=shop-a,shop-b units>=2 -->\nX\n<!-- /when -->', ITEMS);
    expect(markdown).toContain('Only if: supplier: Shop A kit or Shop B and units ≥ 2');
  });

  it('a nested open is a problem with its line, and the body is left unwrapped', () => {
    const body = 'a\n<!-- when temp-kit=true -->\nb\n<!-- when units>=2 -->\nc\n<!-- /when -->\n<!-- /when -->\n';
    const { markdown, problems } = wrapWhenBlocks(body, ITEMS);
    expect(markdown).toBe(body);
    expect(problems.some((p) => p.line === 4 && /nested/.test(p.message))).toBe(true);
  });

  it('an unclosed block is a problem at its opening line', () => {
    const body = 'a\n\n<!-- when temp-kit=true -->\nb\n';
    const { markdown, problems } = wrapWhenBlocks(body, ITEMS);
    expect(markdown).toBe(body);
    expect(problems).toEqual([{ line: 3, message: expect.stringMatching(/never closed/) }]);
  });

  it('a stray close is a problem', () => {
    const { problems } = wrapWhenBlocks('a\n<!-- /when -->\n', ITEMS);
    expect(problems).toEqual([{ line: 2, message: expect.stringMatching(/without a matching/) }]);
  });

  it('a bad condition leaves only that block unwrapped', () => {
    const body = '<!-- when nope=true -->\nA\n<!-- /when -->\n<!-- when temp-kit=true -->\nB\n<!-- /when -->\n';
    const { markdown, problems } = wrapWhenBlocks(body, ITEMS);
    expect(problems).toEqual([{ line: 1, message: expect.stringMatching(/unknown profile id "nope"/) }]);
    expect(markdown).toContain('<!-- when nope=true -->');
    expect(markdown.match(/class="docsi-when"/g)).toHaveLength(1);
  });

  it('ignores comments inside fenced code', () => {
    const body = '```\n<!-- when nope=true -->\n```\n';
    expect(wrapWhenBlocks(body, ITEMS)).toEqual({ markdown: body, problems: [] });
  });

  it('comments that only start with the letters "when" are untouched', () => {
    const body = '<!-- when-ready: film this -->\ntext\n<!-- whenever -->\n';
    expect(wrapWhenBlocks(body, ITEMS)).toEqual({ markdown: body, problems: [] });
  });

  it('other comments are untouched', () => {
    const body = '<!-- TODO: a note -->\ntext\n';
    expect(wrapWhenBlocks(body, ITEMS)).toEqual({ markdown: body, problems: [] });
  });
});

// ---------------------------------------------------------------------------
// Receipt

const RECEIPT_ITEMS: ReceiptItem[] = [
  { component: 'screw', name: 'Screw', per: 'unit', qty: 4, from: ['shop-a', 'shop-b'] },
  { component: 'bag-b', name: 'Bag B', per: 'kit', qty: 1, from: ['shop-a'], note: 'Shared across units' },
  { component: 'probe', name: 'Probe', per: 'unit', qty: 1, when: { 'temp-kit': true } },
  { component: 'cable', name: 'Cable', per: 'unit', qty: 2, supplier: { name: 'Cables Inc', url: 'https://cables.example/c' } },
  { component: 'pump', name: 'Pump', per: 'unit', qty: 1, from: ['shop-b'], supplier: { name: 'Pumps', url: 'https://pumps.example' } },
];
const CONFIG = { multiply_by: 'units', supplier_from: 'supplier' };

describe('computeReceipt', () => {
  it('multiplies per-unit rows, not per-kit rows; orders by name', () => {
    const r = computeReceipt(RECEIPT_ITEMS, { units: 3, 'temp-kit': false, supplier: 'shop-a' }, CONFIG);
    expect(r.units).toBe(3);
    expect(r.supplier).toBe('shop-a');
    expect(r.perUnit.map((x) => [x.component, x.expected])).toEqual([
      ['cable', 6],
      ['screw', 12],
    ]);
    expect(r.perKit.map((x) => [x.component, x.expected])).toEqual([['bag-b', 1]]);
    expect(r.elsewhere.map((x) => x.component)).toEqual(['pump']);
  });

  it('when filtering hides rows', () => {
    const r = computeReceipt(RECEIPT_ITEMS, { units: 1, 'temp-kit': true, supplier: 'shop-a' }, CONFIG);
    expect(r.perUnit.map((x) => x.component)).toEqual(['cable', 'probe', 'screw']);
  });

  it('from filtering: a supplier whose package holds nothing moves every scoped row elsewhere', () => {
    const r = computeReceipt(RECEIPT_ITEMS, { units: 1, 'temp-kit': false, supplier: 'diy' }, CONFIG);
    expect(r.perUnit.map((x) => x.component)).toEqual(['cable']);
    expect(r.perKit).toEqual([]);
    expect(r.elsewhere.map((x) => x.component)).toEqual(['bag-b', 'pump', 'screw']);
  });

  it('no config: units 1, no supplier split', () => {
    const r = computeReceipt(RECEIPT_ITEMS, { 'temp-kit': false }, {});
    expect(r.units).toBe(1);
    expect(r.supplier).toBeUndefined();
    expect(r.elsewhere).toEqual([]);
    expect(r.perUnit.map((x) => x.component)).toEqual(['cable', 'pump', 'screw']);
  });

  it('missingParts: received below expected; absent counts as all received', () => {
    const r = computeReceipt(RECEIPT_ITEMS, { units: 2, 'temp-kit': false, supplier: 'shop-a' }, CONFIG);
    const missing = missingParts(r, { screw: 5, cable: 4, 'bag-b': 0, pump: 0 });
    expect(missing).toEqual([
      { component: 'screw', name: 'Screw', missing: 3, expected: 8, received: 5 },
      { component: 'bag-b', name: 'Bag B', missing: 1, expected: 1, received: 0 },
    ]);
    expect(missingParts(r, {})).toEqual([]);
    expect(missingParts(r, { cable: 1 })[0]).toMatchObject({ supplierUrl: 'https://cables.example/c', missing: 3 });
  });
});

describe('mailto builders', () => {
  const contact = { name: 'Shop A', email: 'help@shop-a.invalid', subject: 'Missing parts: kit' };

  it('missing-parts mailto: encoded subject and body with parts, units and page', () => {
    const href = missingPartsMailto({
      contact,
      missing: [{ component: 'screw', name: 'Screw & nut', missing: 3, expected: 8, received: 5 }],
      units: 2,
      pageUrl: 'https://docs.example/g/s1/',
    })!;
    expect(href.startsWith('mailto:help@shop-a.invalid?subject=Missing%20parts%3A%20kit&body=')).toBe(true);
    const body = decodeURIComponent(href.split('&body=')[1]!);
    expect(body).toContain('- Screw & nut × 3');
    expect(body).toContain('Units ordered: 2');
    expect(body).toContain('Guide page: https://docs.example/g/s1/');
    expect(href).not.toMatch(/[ \n]/);
  });

  it('no email → undefined', () => {
    expect(missingPartsMailto({ contact: { name: 'Shop B' }, missing: [{ component: 'a', name: 'A', missing: 1, expected: 1, received: 0 }], pageUrl: 'x' })).toBeUndefined();
    expect(missingPartsMailto({ contact: undefined, missing: [{ component: 'a', name: 'A', missing: 1, expected: 1, received: 0 }], pageUrl: 'x' })).toBeUndefined();
  });

  it('truncates a long list with "and N more" under the limit', () => {
    const missing = Array.from({ length: 200 }, (_, i) => ({ component: `c${i}`, name: `A rather long component name number ${i}`, missing: 1, expected: 1, received: 0 }));
    const href = missingPartsMailto({ contact, missing, units: 1, pageUrl: 'https://docs.example/' })!;
    expect(href.length).toBeLessThanOrEqual(1800);
    const body = decodeURIComponent(href.split('&body=')[1]!);
    expect(body).toMatch(/- and \d+ more/);
    expect(body).toContain('A rather long component name number 0');
  });

  it('check mailto names step, question, setup and page', () => {
    const href = checkMailto({
      contact: { name: 'Project', email: 'project@example.invalid', subject: 'Guide help' },
      stepTitle: 'Step one',
      question: 'Bubbles?',
      profileSummary: '2 × units',
      pageUrl: 'https://docs.example/g/s1/',
    })!;
    expect(href.startsWith('mailto:project@example.invalid?subject=Guide%20help%3A%20Step%20one&body=')).toBe(true);
    const body = decodeURIComponent(href.split('&body=')[1]!);
    expect(body).toContain('Step: Step one');
    expect(body).toContain('Check: Bubbles?');
    expect(body).toContain('My setup: 2 × units');
    expect(body).toContain('Page: https://docs.example/g/s1/');
    expect(checkMailto({ contact: { name: 'P' }, stepTitle: 'S', question: 'Q', profileSummary: '', pageUrl: 'x' })).toBeUndefined();
  });
});

describe('checks and skipping', () => {
  const checks = [{ id: 'a' }, { id: 'b', when: { 'temp-kit': true } }];
  it('complete only when every visible check is yes', () => {
    expect(checksComplete(checks, { a: 'yes' }, { 'temp-kit': false })).toBe(true);
    expect(checksComplete(checks, { a: 'yes' }, { 'temp-kit': true })).toBe(false);
    expect(checksComplete(checks, { a: 'yes', b: 'no' }, { 'temp-kit': true })).toBe(false);
    expect(checksComplete(checks, { a: 'yes', b: 'yes' }, { 'temp-kit': true })).toBe(true);
    expect(checksComplete([], {}, {})).toBe(false);
    expect(checksComplete(checks, undefined, {})).toBe(false);
  });

  it('next applicable step skips non-matching steps', () => {
    const steps = [
      { title: 'B', href: '/b/', when: { 'temp-kit': true } },
      { title: 'C', href: '/c/' },
    ];
    expect(nextApplicableStep(steps, { 'temp-kit': false })?.title).toBe('C');
    expect(nextApplicableStep(steps, { 'temp-kit': true })?.title).toBe('B');
    expect(nextApplicableStep([], {})).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Loader cross-checks, buildReceipt, media plan and export

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'docsi-interactive-'));
  tmpDirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const VALID_FILES: Record<string, string> = {
  'docsandeye.config.yaml': BASE_CONFIG + PROFILE_YAML,
  'docs/components/screw.yaml': `id: screw\nname: Screw\nkind: off-the-shelf\ndesign_version: 1.0.0\nmaster_format: none\nreceipt: {qty: 4, from: [shop-a, shop-b]}\n`,
  'docs/components/bag-b.yaml': `id: bag-b\nname: Bag B\nkind: kitted\ndesign_version: 1.0.0\nmaster_format: none\nreceipt: {per: kit, from: [shop-a]}\n`,
  'docs/components/probe.yaml': `id: probe\nname: Probe\nkind: off-the-shelf\ndesign_version: 1.0.0\nmaster_format: none\nreceipt: {when: {temp-kit: true}}\n`,
  'docs/components/other-guide-part.yaml': `id: other-guide-part\nname: Other\nkind: off-the-shelf\ndesign_version: 1.0.0\nmaster_format: none\nreceipt: {}\n`,
  'docs/steps/s1.md': `---\nid: s1\norder: 1\ntitle: One\nguide: g\nreceipt: true\nparts:\n  - {component: screw, qty: 4}\n  - {component: probe, when: {temp-kit: true}}\nchecks:\n  - {id: a, question: "Q?", when: {units: ">=2"}}\n---\nText\n\n<!-- when supplier=shop-a -->\nKit only.\n<!-- /when -->\n`,
  'docs/steps/s2.md': `---\nid: s2\norder: 2\ntitle: Two\nguide: g\nwhen: {temp-kit: true}\n---\nBody\n`,
  'docs/media/yt.yaml': `id: yt\ntype: video\nyoutube: dQw4w9WgXcQ\nstart_s: 5\nshot_date: 2026-09-01\nshot_by: Me\nhero: [screw@1.0.0]\n`,
};

describe('loader: when cross-checks and body problems', () => {
  it('a valid interactive project loads with no problems', () => {
    const model = loadProject(project(VALID_FILES));
    expect(model.problems).toEqual([]);
    expect(model.bodyProblems).toEqual([]);
  });

  it('reports unknown profile ids and invalid values at their field paths', () => {
    const root = project({
      ...VALID_FILES,
      'docs/steps/s2.md': `---\nid: s2\norder: 2\ntitle: Two\nguide: g\nwhen: {nope: true}\nparts:\n  - {component: screw, when: {units: many}}\ntools:\n  - {component: screw, when: {supplier: [shop-a, shop-z]}}\nchecks:\n  - {id: a, question: Q, when: {temp-kit: "yes"}}\n---\n`,
      'docs/components/probe.yaml': `id: probe\nname: Probe\nkind: off-the-shelf\ndesign_version: 1.0.0\nmaster_format: none\nreceipt: {when: {units: true}, from: [shop-z]}\n`,
    });
    const model = loadProject(root);
    const at = model.problems.map((p) => `${p.file}:${p.path}`);
    expect(at).toEqual(
      expect.arrayContaining([
        'docs/steps/s2.md:when.nope',
        'docs/steps/s2.md:parts.0.when.units',
        'docs/steps/s2.md:tools.0.when.supplier.1',
        'docs/steps/s2.md:checks.0.when.temp-kit',
        'docs/components/probe.yaml:receipt.when.units',
        'docs/components/probe.yaml:receipt.from.0',
      ]),
    );
    expect(model.problems.every((p) => p.code === 'schema')).toBe(true);
  });

  it('body comment problems go to bodyProblems with file line numbers, not problems', () => {
    const root = project({
      ...VALID_FILES,
      'docs/steps/s2.md': `---\nid: s2\norder: 2\ntitle: Two\nguide: g\n---\nLine one\n<!-- when temp-kit=true -->\nA\n<!-- when units>=2 -->\n`,
    });
    const model = loadProject(root);
    expect(model.problems).toEqual([]);
    // Frontmatter is 6 lines (fences included), so body line 2 is file line 8.
    expect(model.bodyProblems!.map((p) => `${p.file}:${p.path}`)).toEqual(['docs/steps/s2.md:body.line.10', 'docs/steps/s2.md:body.line.8']);
    expect(model.bodyProblems!.every((p) => p.code === 'schema')).toBe(true);
  });

  it('buildReceipt: guide components plus unreferenced receipt items, profile applied', () => {
    const model = loadProject(project(VALID_FILES));
    expect(receiptItems(model, 'g').map((i) => i.component)).toEqual(['bag-b', 'other-guide-part', 'probe', 'screw']);
    const r = buildReceipt(model, 'g', { units: 2, 'temp-kit': false, supplier: 'shop-a' });
    expect(r.perUnit.map((x) => [x.component, x.expected])).toEqual([
      ['other-guide-part', 2],
      ['screw', 8],
    ]);
    expect(r.perKit.map((x) => x.component)).toEqual(['bag-b']);
    const diy = buildReceipt(model, 'g', { units: 1, 'temp-kit': true, supplier: 'diy' });
    expect(diy.elsewhere.map((x) => x.component)).toEqual(['bag-b', 'screw']);
    expect(diy.perUnit.map((x) => x.component)).toEqual(['other-guide-part', 'probe']);
  });

  it('a component referenced only by another guide stays out of this guide', () => {
    const root = project({
      ...VALID_FILES,
      'docsandeye.config.yaml': `guides:\n  - {id: g, title: G, base: /g}\n  - {id: h, title: H, base: /h}\n${PROFILE_YAML}`,
      'docs/steps/h1.md': `---\nid: h1\norder: 1\ntitle: H one\nguide: h\nparts:\n  - {component: other-guide-part}\n---\n`,
    });
    const model = loadProject(root);
    expect(receiptItems(model, 'g').map((i) => i.component)).toEqual(['bag-b', 'probe', 'screw']);
    expect(receiptItems(model, 'h').map((i) => i.component)).toEqual(['bag-b', 'other-guide-part']);
  });

  it('the media plan skips youtube media; export links the watch URL', () => {
    const root = project({ ...VALID_FILES, 'docs/steps/s1.md': `---\nid: s1\norder: 1\ntitle: One\nguide: g\nmedia: [yt]\n---\nText\n` });
    const model = loadProject(root);
    expect(model.problems).toEqual([]);
    expect(buildMediaPlan(model).jobs).toEqual([]);
    const plan = buildExportPlan(model);
    const step = plan.buildup.find((f) => f.path.endsWith('/s1.md'))!;
    expect(step.content).toContain('- [yt](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s): video');
    expect(plan.assets).toEqual([]);
  });
});
