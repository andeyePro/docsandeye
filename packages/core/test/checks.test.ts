/**
 * task_024 — non-leading multiple-choice checks: the `options` schema, the
 * placement of the correct option (evenly distributed, deterministic), the
 * loader applying it per guide, the yes/no warning, and the opaque markers
 * the page uses to tell a right pick from a wrong one.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CheckSchema,
  DocsiError,
  answerKey,
  checkMailto,
  checksComplete,
  correctPosition,
  fnv1aHex,
  guideOffset,
  loadProject,
  localCheckImages,
  optionAnswer,
  optionToken,
  parseStep,
  placeCorrectOption,
  stepsForGuide,
  wrongPick,
  yesNoCheckWarnings,
  type Problem,
} from '../src/index.js';

const HEAD = 'id: s1\norder: 1\ntitle: Step one\n';

function problemsOf(fn: () => unknown): Problem[] {
  try {
    fn();
  } catch (err) {
    if (err instanceof DocsiError) return err.problems;
    throw err;
  }
  return [];
}

const stepProblems = (yaml: string) => problemsOf(() => parseStep(`---\n${HEAD}${yaml}\n---\n`, 's1.md'));

describe('schema: option checks', () => {
  it('parses options with label, image, alt, correct and fix', () => {
    const step = parseStep(
      `---\n${HEAD}checks:\n  - id: shunt\n    question: "Where is the shunt connector?"\n    options:\n      - {label: "On the **left** pins", image: docs/img/left.png, alt: "Shunt on the left pins", fix: "Move it right."}\n      - {label: "On the right pins", correct: true}\n      - {label: "Not fitted", image: "https://example.com/none.jpg", alt: "No shunt"}\n---\n`,
      's1.md',
    );
    const check = step.checks![0]!;
    expect(check.options).toEqual([
      { label: 'On the **left** pins', image: 'docs/img/left.png', alt: 'Shunt on the left pins', fix: 'Move it right.' },
      { label: 'On the right pins', correct: true },
      { label: 'Not fitted', image: 'https://example.com/none.jpg', alt: 'No shunt' },
    ]);
    expect(check.issues).toEqual([]);
    expect(localCheckImages(check)).toEqual(['docs/img/left.png']);
  });

  it('the yes/no form still parses, without options', () => {
    const step = parseStep(`---\n${HEAD}checks:\n  - {id: a, question: "Q?", issues: [{problem: P, fix: F}]}\n---\n`, 's1.md');
    expect(step.checks![0]!.options).toBeUndefined();
  });

  it.each([
    ['one option', 'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true}]}', 'checks.0.options', 'at least 2'],
    [
      'seven options',
      'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true}, {label: B}, {label: C}, {label: D}, {label: E}, {label: F}, {label: G}]}',
      'checks.0.options',
      'at most 6',
    ],
    ['no correct option', 'checks:\n  - {id: a, question: Q, options: [{label: A}, {label: B}]}', 'checks.0.options', 'found 0'],
    ['two correct options', 'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true}, {label: B, correct: true}]}', 'checks.0.options', 'found 2'],
    ['image without alt', 'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true, image: a.png}, {label: B}]}', 'checks.0.options.0.alt', 'alt'],
    ['options and issues', 'checks:\n  - {id: a, question: Q, issues: [{problem: P, fix: F}], options: [{label: A, correct: true}, {label: B}]}', 'checks.0.issues', 'not both'],
    ['fix on the correct option', 'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true, fix: F}, {label: B}]}', 'checks.0.options.0.fix', 'wrong options'],
    ['duplicate labels', 'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true}, {label: A}]}', 'checks.0.options.1.label', 'duplicate'],
    ['absolute image path', 'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true, image: /etc/x.png, alt: X}, {label: B}]}', 'checks.0.options.0.image', 'repo-relative'],
    ['http image', 'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true, image: "http://x.test/a.png", alt: X}, {label: B}]}', 'checks.0.options.0.image', 'https'],
    ['image escaping the repo', 'checks:\n  - {id: a, question: Q, options: [{label: A, correct: true, image: ../a.png, alt: X}, {label: B}]}', 'checks.0.options.0.image', 'repo-relative'],
    ['empty label', 'checks:\n  - {id: a, question: Q, options: [{label: "", correct: true}, {label: B}]}', 'checks.0.options.0.label', 'non-empty'],
  ])('%s is a schema error', (_name, yaml, at, message) => {
    const found = stepProblems(yaml);
    const hit = found.find((p) => p.path === at);
    expect(hit, JSON.stringify(found)).toBeTruthy();
    expect(hit!.message).toContain(message);
  });

  it('CheckSchema is exported and accepts `correct: false` on wrong options', () => {
    expect(CheckSchema.safeParse({ id: 'a', question: 'Q', options: [{ label: 'A', correct: true }, { label: 'B', correct: false }] }).success).toBe(true);
  });
});

describe('placement of the correct option', () => {
  it('correctPosition cycles round robin from the offset', () => {
    expect([0, 1, 2, 3, 4, 5].map((k) => correctPosition(k, 3))).toEqual([0, 1, 2, 0, 1, 2]);
    expect([0, 1, 2, 3].map((k) => correctPosition(k, 2, 1))).toEqual([1, 0, 1, 0]);
    expect(correctPosition(7, 4, 3)).toBe(2);
    expect(() => correctPosition(0, 0)).toThrow(RangeError);
  });

  it('placeCorrectOption moves only the correct one; wrong options keep their order', () => {
    const opts = [{ label: 'a' }, { label: 'b', correct: true }, { label: 'c' }, { label: 'd' }];
    expect(placeCorrectOption(opts, 0).map((o) => o.label)).toEqual(['b', 'a', 'c', 'd']);
    expect(placeCorrectOption(opts, 2).map((o) => o.label)).toEqual(['a', 'c', 'b', 'd']);
    expect(placeCorrectOption(opts, 3).map((o) => o.label)).toEqual(['a', 'c', 'd', 'b']);
    expect(placeCorrectOption(opts, 9).map((o) => o.label)).toEqual(['a', 'c', 'd', 'b']);
    expect(placeCorrectOption([{ label: 'x' }, { label: 'y' }], 1).map((o) => o.label)).toEqual(['x', 'y']);
    // The input is not mutated.
    expect(opts.map((o) => o.label)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('distribution: no position is used more than ceil(N/n)+1 times, for any N, n and offset', () => {
    for (let n = 2; n <= 6; n++) {
      for (let offset = 0; offset < n; offset++) {
        for (let N = 1; N <= 40; N++) {
          const counts = new Array<number>(n).fill(0);
          for (let k = 0; k < N; k++) counts[correctPosition(k, n, offset)]! += 1;
          expect(Math.max(...counts)).toBeLessThanOrEqual(Math.ceil(N / n) + 1);
          // Round robin is in fact exact: every position within one of every other.
          expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('guideOffset is deterministic and in range', () => {
    for (let n = 2; n <= 6; n++) {
      expect(guideOffset('kit', n)).toBe(guideOffset('kit', n));
      expect(guideOffset('kit', n)).toBeGreaterThanOrEqual(0);
      expect(guideOffset('kit', n)).toBeLessThan(n);
    }
  });
});

// ---------------------------------------------------------------------------
// Loader

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'docsi-checks-'));
  tmpDirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const CONFIG = 'guides:\n  - {id: g, title: "Guide", base: /g}\n  - {id: h, title: "Other", base: /h}\n';

/** A step with `count` three-option checks, correct written first every time. */
function stepFile(id: string, order: number, count: number, guide = 'g'): string {
  const checks = Array.from({ length: count }, (_, i) =>
    `  - id: c${i}\n    question: "Where is part ${i}?"\n    options:\n      - {label: "Right", correct: true}\n      - {label: "Wrong one", fix: "Look again."}\n      - {label: "Wrong two"}\n`,
  ).join('');
  return `---\nid: ${id}\norder: ${order}\ntitle: T${order}\nguide: ${guide}\nchecks:\n${checks}---\nBody\n`;
}

const correctAt = (options: readonly { correct?: boolean }[]) => options.findIndex((o) => o.correct === true);

describe('loader: option placement per guide', () => {
  it('cycles the correct position through a guide in reading order, the same every build', () => {
    const files = {
      'docsandeye.config.yaml': CONFIG,
      'docs/steps/s1.md': stepFile('s1', 1, 2),
      'docs/steps/s2.md': stepFile('s2', 2, 3),
      'docs/steps/s3.md': stepFile('s3', 3, 4),
    };
    const model = loadProject(project(files));
    expect(model.problems).toEqual([]);
    const positions = stepsForGuide(model, 'g').flatMap((s) => s.checks!.map((c) => correctAt(c.options!)));
    const offset = guideOffset('g', 3);
    expect(positions).toEqual(positions.map((_, k) => (offset + k) % 3));
    const counts = [0, 1, 2].map((p) => positions.filter((x) => x === p).length);
    expect(counts).toEqual([3, 3, 3]);
    // Wrong options keep their written order.
    for (const s of model.steps.values()) for (const c of s.checks!) expect(c.options!.filter((o) => !o.correct).map((o) => o.label)).toEqual(['Wrong one', 'Wrong two']);
    // Deterministic across loads.
    const again = loadProject(project(files));
    expect(stepsForGuide(again, 'g').flatMap((s) => s.checks!.map((c) => c.options!.map((o) => o.label)))).toEqual(
      stepsForGuide(model, 'g').flatMap((s) => s.checks!.map((c) => c.options!.map((o) => o.label))),
    );
  });

  it('counts per option count, so mixed sizes still cycle', () => {
    const two = `  - id: t\n    question: "Which?"\n    options:\n      - {label: "Yes-ish", correct: true}\n      - {label: "No-ish"}\n`;
    const three = `  - id: r\n    question: "Where?"\n    options:\n      - {label: "A", correct: true}\n      - {label: "B"}\n      - {label: "C"}\n`;
    const files: Record<string, string> = { 'docsandeye.config.yaml': CONFIG };
    for (let i = 1; i <= 6; i++) files[`docs/steps/s${i}.md`] = `---\nid: s${i}\norder: ${i}\ntitle: T\nguide: g\nchecks:\n${two}${three}---\n`;
    const model = loadProject(project(files));
    const steps = stepsForGuide(model, 'g');
    const twos = steps.map((s) => correctAt(s.checks![0]!.options!));
    const threes = steps.map((s) => correctAt(s.checks![1]!.options!));
    expect(twos.filter((p) => p === 0).length).toBe(3);
    expect(threes.filter((p) => p === 0).length).toBe(2);
    expect(threes.filter((p) => p === 2).length).toBe(2);
  });

  it('a step shared by two guides is placed by the first guide in the config', () => {
    const files = {
      'docsandeye.config.yaml': CONFIG,
      'docs/steps/s1.md': stepFile('s1', 1, 1, '[g, h]'),
    };
    const model = loadProject(project(files));
    expect(correctAt(model.steps.get('s1')!.checks![0]!.options!)).toBe(guideOffset('g', 3));
  });

  it('warns about a missing local check image; an https image is not looked up', () => {
    const step = `---\nid: s1\norder: 1\ntitle: T\nchecks:\n  - id: a\n    question: "Which?"\n    options:\n      - {label: A, correct: true, image: docs/img/a.png, alt: "A"}\n      - {label: B, image: docs/img/b.png, alt: "B"}\n      - {label: C, image: "https://example.com/c.png", alt: "C"}\n---\nA B C\n`;
    const model = loadProject(project({ 'docsandeye.config.yaml': CONFIG, 'docs/steps/s1.md': step, 'docs/img/a.png': 'png' }));
    const found = model.warnings!.filter((w) => w.message.startsWith('check image'));
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toBe('check image not found: docs/img/b.png');
    expect(found[0]!.path).toMatch(/^checks\.0\.options\.\d\.image$/);
  });

  it('glossary terms used only in option labels or fixes count as used', () => {
    const step = `---\nid: s1\norder: 1\ntitle: T\nchecks:\n  - id: a\n    question: "Which?"\n    options:\n      - {label: "The shunt is on", correct: true}\n      - {label: B, fix: "Reseat the jumper"}\n---\nBody\n`;
    const glossary = '- {term: shunt, tip: "A tiny link"}\n- {term: jumper, tip: "A wire"}\n- {term: spanner, tip: "A tool"}\n';
    const model = loadProject(project({ 'docsandeye.config.yaml': CONFIG, 'docs/steps/s1.md': step, 'docs/glossary.yaml': glossary }));
    expect(model.problems).toEqual([]);
    expect(model.glossary).toHaveLength(3);
    expect(model.warnings!.filter((w) => w.file === 'docs/glossary.yaml').map((w) => w.message)).toEqual(['glossary term "spanner" never appears in any step']);
  });

  it('yesNoCheckWarnings: one per yes/no check, none for option checks', () => {
    const step = `---\nid: s1\norder: 1\ntitle: T\nchecks:\n  - {id: old, question: "Did you do it?"}\n  - id: new\n    question: "Which?"\n    options:\n      - {label: A, correct: true}\n      - {label: B}\n---\n`;
    const model = loadProject(project({ 'docsandeye.config.yaml': CONFIG, 'docs/steps/s1.md': step }));
    expect(yesNoCheckWarnings(model)).toEqual([{ code: 'schema', file: 'docs/steps/s1.md', path: 'checks.0', message: 'yes/no check "old": rewrite as options' }]);
  });
});

describe('opaque markers and stored answers', () => {
  it('fnv1aHex is the 32-bit FNV-1a', () => {
    expect(fnv1aHex('')).toBe('811c9dc5');
    expect(fnv1aHex('a')).toBe('e40c292c');
    expect(fnv1aHex('foobar')).toBe('bf9cf968');
  });

  it('tokens are stable per label, the key matches only the correct token', () => {
    const right = optionToken('shunt', 'On the right pins');
    const wrong = optionToken('shunt', 'On the left pins');
    expect(right).toMatch(/^[0-9a-f]{8}$/);
    expect(right).not.toBe(wrong);
    expect(optionToken('shunt', 'On the right pins')).toBe(right);
    const key = answerKey('s1', 'shunt', right);
    expect(key).not.toBe(right);
    expect(optionAnswer('s1', 'shunt', key, right)).toBe('yes');
    expect(optionAnswer('s1', 'shunt', key, wrong)).toBe(`no:${wrong}`);
    // The key is scoped to the step and check.
    expect(answerKey('s2', 'shunt', right)).not.toBe(key);
  });

  it('only a correct pick counts as checked; wrongPick reads the stored token', () => {
    expect(checksComplete([{ id: 'a' }], { a: 'no:abcd1234' }, {})).toBe(false);
    expect(checksComplete([{ id: 'a' }], { a: 'yes' }, {})).toBe(true);
    expect(wrongPick('no:abcd1234')).toBe('abcd1234');
    expect(wrongPick('no')).toBeUndefined();
    expect(wrongPick('yes')).toBeUndefined();
    expect(wrongPick(undefined)).toBeUndefined();
  });

  it('the contact email names the option picked', () => {
    const href = checkMailto({ contact: { name: 'P', email: 'p@x.invalid' }, stepTitle: 'S', question: 'Where?', profileSummary: '', pageUrl: 'u', answer: 'On the left pins' })!;
    expect(decodeURIComponent(href)).toContain('My answer: On the left pins');
    expect(decodeURIComponent(checkMailto({ contact: { name: 'P', email: 'p@x.invalid' }, stepTitle: 'S', question: 'Q', profileSummary: '', pageUrl: 'u' })!)).toContain('My answer: No');
  });
});
