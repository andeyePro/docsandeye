/**
 * task_020 — reader-interactive guides in the plugin. Builds
 * `fixtures/site-interactive` (project `fixtures/project-interactive`) once
 * and asserts on the raw HTML: data-when attributes and "Only if" labels,
 * no-JavaScript fallbacks, contacts in data attributes, the YouTube facade
 * making no request to YouTube before a click, and the client bundle.
 * Also unit-tests the plugin's pure view helpers.
 *
 * Expected values come from the spec and the fixture files.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse, type HTMLElement } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadProject, stepsForGuide } from '@docsandeye/core';
import { checkRefs, onlyIf, plainMailto, scriptJson, skipTargets, supplierLabels, whenAttr } from '../src/interactive-view.ts';

const execFileP = promisify(execFile);
const BUILD_TIMEOUT = 600_000;

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const SITE_DIR = path.join(PKG_ROOT, 'fixtures/site-interactive');
const PROJECT_DIR = path.join(PKG_ROOT, 'fixtures/project-interactive');
const DIST = path.join(SITE_DIR, 'dist');

beforeAll(async () => {
  await execFileP('npx', ['astro', 'build'], {
    cwd: SITE_DIR,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-23' },
    timeout: BUILD_TIMEOUT,
    maxBuffer: 1024 * 1024 * 64,
  });
}, BUILD_TIMEOUT);

function raw(rel: string): string {
  return fs.readFileSync(path.join(DIST, rel), 'utf8');
}

function page(rel: string): HTMLElement {
  return parse(raw(rel));
}

function json(el: HTMLElement | null | undefined, attr: string): unknown {
  const value = el?.getAttribute(attr);
  return value === undefined ? undefined : JSON.parse(value);
}

const STEP1 = 'kit/step-01-unpack/index.html';
const STEP2 = 'kit/step-02-probe/index.html';
const STEP3 = 'kit/step-03-finish/index.html';
const STEP4 = 'kit/step-04-unclosed/index.html';
const GUIDE = 'kit/index.html';

describe('profile', () => {
  it('the guide page renders the form with every question, labelled, defaults checked', () => {
    const doc = page(GUIDE);
    const form = doc.querySelector('docsi-profile#docsi-profile form');
    expect(form).toBeTruthy();
    const units = form!.querySelector('input[name="units"]')!;
    expect(units.getAttribute('type')).toBe('number');
    expect(units.getAttribute('min')).toBe('1');
    expect(units.getAttribute('max')).toBe('20');
    expect(units.getAttribute('value')).toBe('1');
    expect(form!.querySelector(`label[for="${units.getAttribute('id')}"]`)!.text).toBe('How many units did you receive?');
    const box = form!.querySelector('input[name="temp-kit"]')!;
    expect(box.getAttribute('type')).toBe('checkbox');
    expect(box.hasAttribute('checked')).toBe(false);
    const radios = form!.querySelectorAll('input[type="radio"][name="supplier"]');
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['shop-a', 'shop-b', 'diy']);
    expect(radios.filter((r) => r.hasAttribute('checked')).map((r) => r.getAttribute('value'))).toEqual(['shop-a']);
    expect(form!.querySelector('fieldset legend')!.text).toBe('Where did your parts come from?');
  });

  it('guide and step pages carry the profile questions as JSON', () => {
    for (const rel of [GUIDE, STEP1, STEP3]) {
      const script = page(rel).querySelector('script[data-docsi-profile]');
      expect(script?.getAttribute('type')).toBe('application/json');
      const items = JSON.parse(script!.text) as Array<{ id: string }>;
      expect(items.map((i) => i.id)).toEqual(['units', 'temp-kit', 'supplier']);
    }
  });

  it('every step shows a summary bar linking to the guide form, hidden until upgraded', () => {
    for (const rel of [STEP1, STEP2, STEP3]) {
      const bar = page(rel).querySelector('docsi-profile-summary[data-guide="kit"] .docsi-profile-summary');
      expect(bar?.hasAttribute('hidden')).toBe(true);
      expect(bar!.querySelector('a')!.getAttribute('href')).toBe('/kit/#docsi-profile');
    }
  });

  it('a step with profile: true renders the form; others do not', () => {
    expect(page(STEP1).querySelector('docsi-profile form')).toBeTruthy();
    expect(page(STEP3).querySelector('docsi-profile')).toBeFalsy();
  });
});

describe('conditional content', () => {
  it('a body when block becomes a labelled div with its condition as JSON', () => {
    const block = page(STEP1).querySelector('.docsi-body div.docsi-when');
    expect(block).toBeTruthy();
    expect(json(block, 'data-when')).toEqual({ units: '>=2' });
    expect(block!.querySelector('p.docsi-when-label')!.text).toBe('Only if: units ≥ 2');
    expect(block!.text).toContain('Building several units? Sort the parts into one tray per unit.');
  });

  it('choice lists read as option labels; ordinary comments stay comments', () => {
    const html = raw(STEP3);
    const block = parse(html).querySelector('.docsi-body div.docsi-when');
    expect(json(block, 'data-when')).toEqual({ supplier: ['shop-a', 'shop-b'] });
    expect(block!.querySelector('.docsi-when-label')!.text).toBe('Only if: supplier: Shop A kit or Shop B');
    expect(html).toContain('<!-- TODO: an ordinary comment stays a comment -->');
    expect(html).not.toContain('<!-- when');
  });

  it('an unclosed block renders its text unwrapped and the build succeeds', () => {
    const body = page(STEP4).querySelector('.docsi-body')!;
    expect(body.querySelector('.docsi-when')).toBeFalsy();
    expect(body.text).toContain('This block is never closed, so it renders unwrapped.');
  });

  it('a conditional part carries data-when and an Only if label', () => {
    const li = page(STEP3).querySelector('.docsi-parts li[data-component="bracket"]');
    expect(json(li, 'data-when')).toEqual({ supplier: 'shop-b' });
    expect(li!.querySelector('.docsi-when-inline')!.text).toBe('Only if: supplier: Shop B');
    expect(page(STEP3).querySelector('.docsi-parts li[data-component="widget"]')!.hasAttribute('data-when')).toBe(false);
  });

  it('a conditional step shows its condition and a hidden notice pointing at the following steps', () => {
    const doc = page(STEP2);
    expect(doc.querySelector('.docsi-step-condition')!.text).toBe('Only if: temp-kit: yes');
    const notice = doc.querySelector('.docsi-skip-notice')!;
    expect(notice.hasAttribute('hidden')).toBe(true);
    expect(notice.getAttribute('data-when-mode')).toBe('unless');
    expect(json(notice, 'data-when')).toEqual({ 'temp-kit': true });
    expect(json(notice, 'data-next')).toEqual([
      { title: 'Finish the build', href: '/kit/step-03-finish/' },
      { title: 'A body with an unclosed block', href: '/kit/step-04-unclosed/' },
    ]);
    expect(notice.text).toContain("This step doesn't apply to your setup (temp-kit: yes).");
    expect(notice.querySelector('a.docsi-skip-link')!.getAttribute('href')).toBe('/kit/');
  });

  it('guide list and sidebar entries of a conditional step are marked for skipping, not removed', () => {
    for (const [rel, selector] of [
      [GUIDE, '.docsi-guide-steps'],
      [STEP1, '.docsi-sidebar'],
    ] as const) {
      const list = page(rel).querySelector(selector)!;
      expect(list.querySelectorAll('li[data-step]').map((li) => li.getAttribute('data-step'))).toEqual([
        'step-01-unpack',
        'step-02-probe',
        'step-03-finish',
        'step-04-unclosed',
      ]);
      const li = list.querySelector('li[data-step="step-02-probe"]')!;
      expect(li.getAttribute('data-when-mode')).toBe('skip');
      expect(json(li, 'data-when')).toEqual({ 'temp-kit': true });
      const note = li.querySelector('.docsi-skip-note')!;
      expect(note.hasAttribute('hidden')).toBe(true);
      expect(note.text.trim()).toBe('(not for your setup)');
      expect(list.querySelector('li[data-step="step-01-unpack"]')!.hasAttribute('data-when')).toBe(false);
    }
  });

  it('guide list and sidebar entries with checks carry them for the tick', () => {
    const li = page(GUIDE).querySelector('.docsi-guide-steps li[data-step="step-03-finish"]')!;
    expect(json(li, 'data-checks')).toEqual([{ id: 'rigid' }, { id: 'probe-seated', when: { 'temp-kit': true } }]);
    expect(li.querySelector('.docsi-checked-mark')!.hasAttribute('hidden')).toBe(true);
    expect(page(GUIDE).querySelector('li[data-step="step-04-unclosed"]')!.hasAttribute('data-checks')).toBe(false);
  });
});

describe('receipt checklist', () => {
  const receipt = () => page(STEP1).querySelector('docsi-receipt')!;

  it('renders only on the step with receipt: true', () => {
    expect(receipt()).toBeTruthy();
    expect(page(STEP3).querySelector('docsi-receipt')).toBeFalsy();
  });

  it('carries items, config, contacts (with emails) and supplier labels in data attributes', () => {
    const el = receipt();
    expect(el.getAttribute('data-guide')).toBe('kit');
    expect(json(el, 'data-config')).toEqual({ multiply_by: 'units', supplier_from: 'supplier' });
    expect(json(el, 'data-contacts')).toEqual({
      'shop-a': { name: 'Shop A', email: 'support@shop-a.invalid', subject: 'Missing parts: kit order' },
      'shop-b': { name: 'Shop B' },
      project: { name: 'The project', email: 'help@project.invalid', subject: 'Kit guide: help with a step' },
    });
    expect(json(el, 'data-supplier-labels')).toEqual({ 'shop-a': 'Shop A kit', 'shop-b': 'Shop B', diy: 'Sourced myself' });
    const items = json(el, 'data-items') as Array<{ component: string; per: string; qty: number }>;
    expect(items.map((i) => [i.component, i.per, i.qty])).toEqual([
      ['bracket', 'unit', 1],
      ['spares-bag', 'kit', 1],
      ['probe', 'unit', 1],
      ['widget', 'unit', 2],
    ]);
  });

  it('without JavaScript: per-unit and per-kit tables with per-unit quantities, conditions labelled', () => {
    const tables = receipt().querySelectorAll('.docsi-receipt-static table');
    expect(tables.map((t) => t.querySelector('caption')!.text)).toEqual([
      'Per unit (multiply by your number of units)',
      'Per kit (does not scale with units)',
    ]);
    const rows = (t: HTMLElement) => t.querySelectorAll('tbody tr').map((tr) => tr.querySelectorAll('td').map((td) => td.text.trim()));
    expect(rows(tables[0]!)).toEqual([
      ['Bracket', '1', 'Shop B'],
      ['Temperature probeOnly if: temp-kit: yes', '1', 'all'],
      ['Widget', '2', 'Shop A kit, Shop B'],
    ]);
    expect(rows(tables[1]!)).toEqual([['Spares bagBag B, shared across units', '1', 'Shop A kit']]);
    expect(json(tables[0]!.querySelector('tr[data-component="probe"]'), 'data-when')).toEqual({ 'temp-kit': true });
    const contacts = receipt().querySelector('.docsi-receipt-contacts')!;
    expect(contacts.querySelector('a')!.getAttribute('href')).toBe('mailto:support@shop-a.invalid?subject=Missing%20parts%3A%20kit%20order');
    expect(receipt().querySelector('.docsi-receipt-live')!.hasAttribute('hidden')).toBe(true);
  });

  it('components without receipt data are not in the checklist', () => {
    expect(raw(STEP1)).not.toMatch(/data-items="[^"]*plain/);
  });
});

describe('step checks', () => {
  const checks = () => page(STEP1).querySelector('docsi-checks')!;

  it('sits after the parts list and before safety', () => {
    const html = raw(STEP3);
    expect(html.indexOf('class="docsi-parts"')).toBeLessThan(html.indexOf('<docsi-checks'));
    expect(html.indexOf('<docsi-checks')).toBeLessThan(html.indexOf('class="docsi-safety"'));
  });

  it('without JavaScript: the questions as a list with issues in <details>; radios hidden', () => {
    const el = checks();
    expect(el.getAttribute('data-step')).toBe('step-01-unpack');
    expect(el.getAttribute('data-step-title')).toBe('Unpack the kit');
    const items = el.querySelectorAll('ol.docsi-checks-list > li[data-check]');
    expect(items.map((li) => li.getAttribute('data-check'))).toEqual(['count', 'dry']);
    expect(items[0]!.querySelector('.docsi-check-q')!.text.trim()).toBe('Did every part on the list arrive?');
    const issues = items[0]!.querySelectorAll('details.docsi-check-issues li');
    expect(issues.map((li) => li.querySelector('strong')!.text)).toEqual(['A part is missing', 'A part is damaged']);
    expect(items[1]!.querySelector('details')).toBeFalsy();
    const answer = items[0]!.querySelector('.docsi-check-answer')!;
    expect(answer.hasAttribute('hidden')).toBe(true);
    expect(answer.querySelectorAll('input[type="radio"]').map((r) => r.getAttribute('value'))).toEqual(['yes', 'no']);
    expect(el.querySelector('.docsi-checks-done')!.hasAttribute('hidden')).toBe(true);
  });

  it('draft note only with checks_draft', () => {
    expect(checks().querySelector('.docsi-checks-draft')!.text).toBe('Draft checks, under review');
    expect(page(STEP3).querySelector('.docsi-checks-draft')).toBeFalsy();
  });

  it('the project contact travels in a data attribute; a noscript contact link names the step', () => {
    const el = checks();
    expect(json(el, 'data-contact')).toEqual({ name: 'The project', email: 'help@project.invalid', subject: 'Kit guide: help with a step' });
    const noscript = el.querySelector('noscript')!;
    expect(noscript.innerHTML).toContain('mailto:help@project.invalid?subject=Kit%20guide%3A%20help%20with%20a%20step%3A%20Unpack%20the%20kit');
  });

  it('a conditional check carries data-when and a label', () => {
    const li = page(STEP3).querySelector('li[data-check="probe-seated"]')!;
    expect(json(li, 'data-when')).toEqual({ 'temp-kit': true });
    expect(li.querySelector('.docsi-when-label')!.text).toBe('Only if: temp-kit: yes');
  });
});

describe('YouTube facade', () => {
  const YOUTUBE_URL_RE = /(?:youtube(?:-nocookie)?\.com|youtu\.be|ytimg\.com|googlevideo\.com)/i;

  it('click-to-load: the embed URL only in data-embed, the watch URL only in the noscript link', () => {
    const doc = page(STEP1);
    const el = doc.querySelector('docsi-youtube[data-media="yt-01-unpack"]')!;
    expect(el.getAttribute('data-embed')).toBe('https://www.youtube-nocookie.com/embed/AbCdEfGhIj0?autoplay=1&start=12&end=40&rel=0');
    expect(el.getAttribute('data-title')).toBe('Unpack the kit');
    const button = el.querySelector('button.docsi-youtube-play')!;
    expect(button.hasAttribute('hidden')).toBe(true);
    expect(button.querySelector('.docsi-youtube-title')!.text).toBe('Unpack the kit');
    expect(button.querySelector('.docsi-youtube-duration')!.text).toBe('0:28');
    expect(el.querySelector('noscript')!.innerHTML).toContain('href="https://www.youtube.com/watch?v=AbCdEfGhIj0&amp;t=12s"');
    expect(doc.querySelector('iframe')).toBeFalsy();
  });

  for (const rel of [STEP1, STEP3]) {
    it(`${rel}: no YouTube request URL outside data-embed and <noscript>`, () => {
      const stripped = raw(rel)
        .replace(/\sdata-embed="[^"]*"/g, '')
        .replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
      expect(stripped).not.toMatch(YOUTUBE_URL_RE);
    });
  }

  it('the STALE flow gates a YouTube clip behind "Watch the older video", banner included', () => {
    const details = page(STEP3).querySelector('details.docsi-stale.docsi-stale-video')!;
    expect(details.querySelector('button.docsi-watch-older')).toBeTruthy();
    const older = details.querySelector('.docsi-older')!;
    expect(older.hasAttribute('hidden')).toBe(true);
    const el = older.querySelector('docsi-youtube[data-media="yt-03-old"]')!;
    expect(el.getAttribute('data-status')).toBe('STALE');
    expect(el.getAttribute('data-embed')).toBe('https://www.youtube-nocookie.com/embed/ZyXwVuTsRq9?autoplay=1&rel=0');
    expect(el.querySelector('.docsi-banner')!.text).toBe('Recorded with Widget v1.0.0, current is v1.1.0');
    const noscript = details.querySelectorAll('noscript').find((n) => n.innerHTML.includes('watch?v=ZyXwVuTsRq9'));
    expect(noscript).toBeTruthy();
  });

  it('no video file is copied for YouTube media', () => {
    expect(fs.existsSync(path.join(DIST, '_docsandeye/media'))).toBe(false);
  });
});

describe('client bundle', () => {
  it('the step registering script defines the new elements and stays small', () => {
    const doc = page(STEP1);
    const scripts = doc
      .querySelectorAll('script[type="module"][src]')
      .map((s) => fs.readFileSync(path.join(DIST, s.getAttribute('src')!.replace(/^\//, '')), 'utf8').replace(/'/g, '"'));
    const registering = scripts.filter((c) => c.includes('customElements.define("docsi-step"'));
    expect(registering).toHaveLength(1);
    for (const name of ['docsi-youtube', 'docsi-profile', 'docsi-profile-summary', 'docsi-receipt', 'docsi-checks']) {
      expect(registering[0]).toContain(`customElements.define("${name}"`);
    }
    const total = fs
      .readdirSync(path.join(DIST, '_astro'))
      .filter((f) => f.endsWith('.js') && !f.startsWith('model-viewer') && !f.startsWith('ui-core'))
      .reduce((sum, f) => sum + fs.statSync(path.join(DIST, '_astro', f)).size, 0);
    expect(total).toBeLessThan(60 * 1024);
  });

  it('the guide page loads the profile form and the condition evaluator', () => {
    const doc = page(GUIDE);
    const scripts = doc
      .querySelectorAll('script[type="module"][src]')
      .map((s) => fs.readFileSync(path.join(DIST, s.getAttribute('src')!.replace(/^\//, '')), 'utf8').replace(/'/g, '"'));
    expect(scripts.some((c) => c.includes('customElements.define("docsi-profile"'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pure view helpers

describe('interactive view helpers', () => {
  const model = loadProject(PROJECT_DIR);

  it('whenAttr and onlyIf', () => {
    expect(whenAttr(undefined)).toBeUndefined();
    expect(whenAttr({})).toBeUndefined();
    expect(whenAttr({ units: '>=2' })).toBe('{"units":">=2"}');
    expect(onlyIf({ supplier: 'shop-b' }, model.config.profile)).toBe('Only if: supplier: Shop B');
    expect(onlyIf(undefined, model.config.profile)).toBeUndefined();
  });

  it('scriptJson cannot close its script element', () => {
    expect(scriptJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}');
  });

  it('skipTargets lists the later steps with their conditions', () => {
    const steps = stepsForGuide(model, 'kit');
    const guide = model.config.guides[0]!;
    expect(skipTargets(steps, 'step-01-unpack', guide, '/docs/').map((s) => s.href)).toEqual([
      '/docs/kit/step-02-probe/',
      '/docs/kit/step-03-finish/',
      '/docs/kit/step-04-unclosed/',
    ]);
    expect(skipTargets(steps, 'step-01-unpack', guide)[0]).toEqual({ title: 'Fit the temperature probe', href: '/kit/step-02-probe/', when: { 'temp-kit': true } });
    expect(skipTargets(steps, 'step-04-unclosed', guide)).toEqual([]);
  });

  it('checkRefs and supplierLabels', () => {
    expect(checkRefs(model.steps.get('step-04-unclosed')!)).toBeUndefined();
    expect(checkRefs(model.steps.get('step-02-probe')!)).toEqual([{ id: 'reads' }]);
    expect(supplierLabels(model)).toEqual({ 'shop-a': 'Shop A kit', 'shop-b': 'Shop B', diy: 'Sourced myself' });
  });

  it('plainMailto', () => {
    expect(plainMailto({ name: 'X' })).toBeUndefined();
    expect(plainMailto({ name: 'X', email: 'x@y.invalid' })).toBe('mailto:x@y.invalid');
    expect(plainMailto({ name: 'X', email: 'x@y.invalid', subject: 'Hi there' }, 'Step')).toBe('mailto:x@y.invalid?subject=Hi%20there%3A%20Step');
  });

  it('the fixture has a body problem that check reports and the build tolerates', () => {
    expect(model.problems).toEqual([]);
    expect(model.bodyProblems!.map((p) => `${p.file}:${p.path}`)).toEqual(['docs/steps/step-04-unclosed.md:body.line.9']);
  });
});
