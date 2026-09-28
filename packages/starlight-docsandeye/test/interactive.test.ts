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
import { answerKey, loadProject, optionToken, stepsForGuide } from '@docsandeye/core';
import { checkRefs, guideReceiptItems, onlyIf, plainMailto, scriptJson, siteHref, skipTargets, supplierLabels, whenAttr } from '../src/interactive-view.ts';
import { ASIDE_ICON_NAMES, ASIDE_ICONS, ASIDE_VARIANTS, asideMarkdown } from '../src/asides.ts';
import { renderMarkdown } from '../src/markdown.ts';
import { guideIndexPagination, guidePageLinks, olderVideoSentence, sidebarEntryAfter, sidebarTargetHref, slugLabel, stepPagination } from '../src/view.ts';

const execFileP = promisify(execFile);
const BUILD_TIMEOUT = 600_000;

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const SITE_DIR = path.join(PKG_ROOT, 'fixtures/site-interactive');
const PROJECT_DIR = path.join(PKG_ROOT, 'fixtures/project-interactive');
const REPO_ROOT = path.resolve(PKG_ROOT, '../..');
const DIST = path.join(SITE_DIR, 'dist');
const DIST_MAINTAINER = path.join(SITE_DIR, 'dist-maintainer');

beforeAll(async () => {
  await execFileP('npx', ['astro', 'build'], {
    cwd: SITE_DIR,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-23' },
    timeout: BUILD_TIMEOUT,
    maxBuffer: 1024 * 1024 * 64,
  });
  // task_023: draft material is maintainer-only, so the same site is also built in maintainer mode.
  await execFileP('npx', ['astro', 'build', '--outDir', './dist-maintainer'], {
    cwd: SITE_DIR,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-23', DOCSANDEYE_MAINTAINER: '1' },
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

function maintainerPage(rel: string): HTMLElement {
  return parse(fs.readFileSync(path.join(DIST_MAINTAINER, rel), 'utf8'));
}

/** Text as a sighted reader sees it: without the visually hidden glossary descriptions. */
function visibleText(el: HTMLElement): string {
  const copy = parse(el.outerHTML);
  for (const tip of copy.querySelectorAll('.docsi-term-tip')) tip.remove();
  return copy.text;
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
    expect(form!.querySelector('fieldset[data-profile-field="supplier"] legend')!.text).toBe('Where did your parts come from?');
  });

  it('guide and step pages carry the profile questions as JSON', () => {
    for (const rel of [GUIDE, STEP1, STEP3]) {
      const script = page(rel).querySelector('script[data-docsi-profile]');
      expect(script?.getAttribute('type')).toBe('application/json');
      const items = JSON.parse(script!.text) as Array<{ id: string }>;
      expect(items.map((i) => i.id)).toEqual(['build', 'units', 'temp-kit', 'supplier']);
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
    expect(block!.querySelector('p.docsi-when-label')!.text).toBe('Only if: 2 or more units');
    expect(visibleText(block!)).toContain('Building several units? Sort the parts into one tray per unit.');
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
    expect(doc.querySelector('.docsi-step-condition')!.text).toBe('Only with temperature upgrade');
    const notice = doc.querySelector('.docsi-skip-notice')!;
    expect(notice.hasAttribute('hidden')).toBe(true);
    expect(notice.getAttribute('data-when-mode')).toBe('unless');
    expect(json(notice, 'data-when')).toEqual({ 'temp-kit': true });
    expect(json(notice, 'data-next')).toEqual([
      { title: 'Finish the build', href: '/kit/step-03-finish/' },
      { title: 'A body with an unclosed block', href: '/kit/step-04-unclosed/' },
    ]);
    expect(notice.text).toContain("This step doesn't apply to your setup (with temperature upgrade).");
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
    expect(json(li, 'data-checks')).toEqual([{ id: 'rigid' }, { id: 'probe-seated', when: { 'temp-kit': true } }, { id: 'config' }, { id: 'frame-feet' }]);
    expect(li.querySelector('.docsi-checked-mark')!.hasAttribute('hidden')).toBe(true);
    expect(page(GUIDE).querySelector('li[data-step="step-04-unclosed"]')!.hasAttribute('data-checks')).toBe(false);
  });
});

describe('repo-relative links in step bodies', () => {
  // Fixture: project.repo https://github.com/example/kit, branch dev; step-03-finish's last paragraphs.
  const REPO = 'https://github.com/example/kit';
  const hrefs = () => Object.fromEntries(page(STEP3).querySelectorAll('.docsi-body a').map((a) => [a.text.trim(), a.getAttribute('href')]));

  it('a step of the same guide links to its page, fragment kept', () => {
    expect(hrefs()).toMatchObject({ unpacking: '/kit/step-01-unpack/#keep-the-spares', probe: '/kit/step-02-probe/' });
  });

  it('other project paths (and another guide\'s step) link to GitHub on the branch, encoded, folders without the slash', () => {
    expect(hrefs()).toMatchObject({
      'widget file': `${REPO}/blob/dev/docs/components/widget.yaml`,
      readme: `${REPO}/blob/dev/README.md#over-ssh`,
      'cap folder': `${REPO}/blob/dev/Components/Vial%20Cap`,
      'other guide’s step': `${REPO}/blob/dev/docs/steps/other-01-paint.md`,
      'The parts folder': `${REPO}/blob/dev/docs/components`,
    });
    expect(page(STEP3).querySelector('.docsi-body img[alt="Wiring"]')!.getAttribute('src')).toBe(`${REPO}/raw/dev/Media/wiring%20diagram.png`);
  });

  it('a path above the project root, absolute URLs and fragments are left as written', () => {
    expect(hrefs()).toMatchObject({ outside: '../../../elsewhere/notes.md', 'the site': 'https://example.com/x', top: '#_top' });
  });
});

describe('receipt checklist', () => {
  const receipt = () => page(STEP1).querySelector('docsi-receipt')!;

  it('renders only on the step with receipt: true', () => {
    expect(receipt()).toBeTruthy();
    expect(page(STEP3).querySelector('docsi-receipt')).toBeFalsy();
  });

  it('carries config, contacts (with emails) and supplier labels in data attributes', () => {
    const el = receipt();
    expect(el.getAttribute('data-guide')).toBe('kit');
    expect(json(el, 'data-config')).toEqual({ multiply_by: 'units', supplier_from: 'supplier' });
    expect(json(el, 'data-contacts')).toEqual({
      'shop-a': { name: 'Shop A', email: 'support@shop-a.invalid', subject: 'Missing parts: kit order' },
      'shop-b': { name: 'Shop B' },
      project: { name: 'The project', email: 'help@project.invalid', subject: 'Kit guide: help with a step' },
    });
    expect(json(el, 'data-supplier-labels')).toEqual({ 'shop-a': 'Shop A kit', 'shop-b': 'Shop B', diy: 'Sourced myself from the BoM' });
  });

  it('each table row carries its item data for the element (per, qty, from, when, supplier)', () => {
    const rows = receipt().querySelectorAll('.docsi-receipt-static tr[data-component]');
    const data = rows.map((tr) => [
      tr.getAttribute('data-component'),
      tr.getAttribute('data-per'),
      tr.getAttribute('data-qty'),
      tr.getAttribute('data-from') ?? null,
      tr.getAttribute('data-supplier-url') ?? null,
    ]);
    expect(data).toEqual([
      ['bracket', 'unit', '1', 'shop-b', 'https://brackets.example/b'],
      ['probe', 'unit', '1', null, 'https://probes.example/p'],
      ['widget', 'unit', '2', 'shop-a shop-b', 'https://widgets.example/widget'],
      ['spares-bag', 'kit', '1', 'shop-a', null],
    ]);
  });

  it('without JavaScript: per-unit and per-kit tables with per-unit quantities, conditions labelled', () => {
    const tables = receipt().querySelectorAll('.docsi-receipt-static table');
    expect(tables.map((t) => t.querySelector('caption')!.text)).toEqual([
      'Per unit (multiply by your number of units)',
      'Per kit (does not scale with units)',
    ]);
    const rows = (t: HTMLElement) => t.querySelectorAll('tbody tr').map((tr) => tr.querySelectorAll('td').map((td) => visibleText(td).trim()));
    expect(rows(tables[0]!)).toEqual([
      ['Bracket', '1', 'Shop B'],
      ['Temperature probeOnly with temperature upgrade', '1', 'all'],
      ['Widget', '2', 'Shop A kit, Shop B'],
    ]);
    expect(rows(tables[1]!)).toEqual([['Spares bagBag B, shared across units', '1', 'Shop A kit']]);
    expect(json(tables[0]!.querySelector('tr[data-component="probe"]'), 'data-when')).toEqual({ 'temp-kit': true });
    const contacts = receipt().querySelector('.docsi-receipt-contacts')!;
    expect(contacts.querySelector('a')!.getAttribute('href')).toBe('mailto:support@shop-a.invalid?subject=Missing%20parts%3A%20kit%20order');
    expect(receipt().querySelector('.docsi-receipt-live')!.hasAttribute('hidden')).toBe(true);
  });

  it('components without receipt data are not in the checklist', () => {
    expect(receipt().querySelector('tr[data-component="plain"]')).toBeFalsy();
  });
});

describe('step checks', () => {
  const checks = () => page(STEP1).querySelector('docsi-checks')!;

  it('sits after the parts list; safety leads the step body (task_023)', () => {
    const html = raw(STEP3);
    expect(html.indexOf('class="docsi-parts"')).toBeLessThan(html.indexOf('<docsi-checks'));
    expect(html.indexOf('class="docsi-safety"')).toBeLessThan(html.indexOf('class="docsi-body'));
  });

  it('without JavaScript: the questions as a list with issues in <details>; radios hidden', () => {
    const el = checks();
    expect(el.getAttribute('data-step')).toBe('step-01-unpack');
    expect(el.getAttribute('data-step-title')).toBe('Unpack the kit');
    const items = el.querySelectorAll('ol.docsi-checks-list > li[data-check]');
    expect(items.map((li) => li.getAttribute('data-check'))).toEqual(['count', 'dry', 'laid-out']);
    expect(items[0]!.querySelector('.docsi-check-q')!.text.trim()).toBe('Did every part on the list arrive?');
    const issues = items[0]!.querySelectorAll('details.docsi-check-issues li');
    expect(issues.map((li) => li.querySelector('strong')!.text)).toEqual(['A part is missing', 'A part is damaged']);
    expect(items[1]!.querySelector('details')).toBeFalsy();
    const answer = items[0]!.querySelector('.docsi-check-answer')!;
    expect(answer.hasAttribute('hidden')).toBe(true);
    expect(answer.querySelectorAll('input[type="radio"]').map((r) => r.getAttribute('value'))).toEqual(['yes', 'no']);
    expect(el.querySelector('.docsi-checks-done')!.hasAttribute('hidden')).toBe(true);
  });

  it('draft note only with checks_draft, and only in a maintainer build (task_023)', () => {
    expect(checks().querySelector('.docsi-checks-draft')).toBeFalsy();
    expect(maintainerPage(STEP1).querySelector('docsi-checks .docsi-checks-draft')!.text).toBe('Draft checks, under review');
    expect(maintainerPage(STEP3).querySelector('.docsi-checks-draft')).toBeFalsy();
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
    expect(li.querySelector('.docsi-when-label')!.text).toBe('Only with temperature upgrade');
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
// task_021: implications, link options, layout, check-offs, consent, navigation

describe('profile: implies, link options and label links', () => {
  const form = () => page(GUIDE).querySelector('docsi-profile form')!;

  it('every question is a data-profile-field the element can hide', () => {
    expect(form().querySelectorAll('[data-profile-field]').map((f) => f.getAttribute('data-profile-field'))).toEqual(['build', 'units', 'temp-kit', 'supplier']);
  });

  it('a link option is a link in the radio list, never a radio', () => {
    const field = form().querySelector('fieldset[data-profile-field="build"]')!;
    expect(field.querySelectorAll('input[type="radio"]').map((r) => r.getAttribute('value'))).toEqual(['full', 'basic', 'custom']);
    const link = field.querySelector('a.docsi-profile-link')!;
    expect(link.getAttribute('href')).toBe('/other/');
    expect(link.text.trim()).toBe('Another kit: use the other guide');
    expect(link.classList.contains('docsi-profile-option')).toBe(true);
  });

  it('the implying options travel in the profile JSON for the client', () => {
    const items = JSON.parse(page(GUIDE).querySelector('script[data-docsi-profile]')!.text) as Array<{ id: string; options?: unknown[] }>;
    expect(items[0]!.options).toEqual([
      { value: 'full', label: 'Full kit (temperature upgrade included)', implies: { 'temp-kit': true } },
      { value: 'basic', label: 'Basic kit', implies: { 'temp-kit': false } },
      { value: 'custom', label: 'Custom build: I will say what I have' },
      { value: 'other', label: 'Another kit: use the other guide', href: '/other/' },
    ]);
  });

  it('a Markdown link in an option label: plain text in the label, a separate "site" link after it (task_023)', () => {
    const label = form().querySelector('input[name="supplier"][value="diy"]')!.parentNode as unknown as HTMLElement;
    expect(label.tagName).toBe('LABEL');
    expect(label.text.replace(/\s+/g, ' ').trim()).toBe('Sourced myself from the BoM');
    expect(label.querySelector('a')).toBeFalsy();
    const option = label.parentNode as unknown as HTMLElement;
    expect(option.classList.contains('docsi-profile-option')).toBe(true);
    const a = option.querySelector('a.docsi-profile-site')!;
    expect(a.parentNode).toBe(option);
    expect(a.getAttribute('href')).toBe('https://bom.example/list');
    expect(a.text.trim()).toBe('site');
    expect(a.getAttribute('aria-label')).toBe('the BoM (site)');
    expect(form().outerHTML).not.toContain('[the BoM]');
    expect(form().querySelectorAll('label a')).toHaveLength(0);
  });
});

describe('step layout: media above, stale video below', () => {
  it('the media pane comes first, then the text, in one column', () => {
    const step = page(STEP1).querySelector('docsi-step')!;
    expect(step.childNodes.filter((n) => n.nodeType === 1).map((n) => (n as HTMLElement).classList.value[0])).toEqual(['docsi-media', 'docsi-text']);
    expect(step.querySelector('.docsi-media > figure.docsi-video-figure docsi-youtube')).toBeTruthy();
  });

  it('a STALE video moves to an "Older video" section at the bottom, introduced by one sentence', () => {
    const doc = page(STEP3);
    expect(doc.querySelector('.docsi-media')).toBeFalsy();
    const section = doc.querySelector('.docsi-text > section.docsi-older-video')!;
    expect(section.querySelector('h2')!.text).toBe('Older video');
    expect(section.querySelector('p.docsi-older-intro')!.text).toBe('This video shows Widget v1.0.0 where your kit has Widget v1.1.0.');
    const details = section.querySelector('details.docsi-stale-video')!;
    expect(details.hasAttribute('open')).toBe(true);
    expect(details.querySelector('docsi-youtube[data-media="yt-03-old"]')).toBeTruthy();
    const html = raw(STEP3);
    expect(html.indexOf('class="docsi-safety"')).toBeLessThan(html.indexOf('class="docsi-older-video"'));
    expect(html.indexOf('class="docsi-older-video"')).toBeLessThan(html.indexOf('class="docsi-meta"'));
  });
});

describe('check-offs', () => {
  it('every part and tool row starts with a hidden "have it" box keyed step/component', () => {
    const rows = page(STEP1).querySelectorAll('.docsi-parts li');
    expect(rows.map((li) => li.firstChild && (li.childNodes.find((n) => n.nodeType === 1) as HTMLElement).getAttribute('data-checkoff'))).toEqual([
      'step-01-unpack/widget',
      'step-01-unpack/spares-bag',
      'step-01-unpack/plain',
    ]);
    const box = rows[0]!.querySelector('input.docsi-checkoff')!;
    expect(box.getAttribute('type')).toBe('checkbox');
    expect(box.hasAttribute('hidden')).toBe(true);
    expect(box.getAttribute('aria-label')).toBe('Have it: Widget');
  });

  it('the receipt knows its step (for its rows\' check-offs)', () => {
    expect(page(STEP1).querySelector('docsi-receipt')!.getAttribute('data-step')).toBe('step-01-unpack');
  });
});

describe('saving consent', () => {
  for (const rel of [GUIDE, STEP1, STEP3]) {
    it(`${rel}: a hidden consent bar with Save / Don't save and a hidden not-saved notice`, () => {
      const doc = page(rel);
      const bar = doc.querySelector('.docsi-consent-bar')!;
      expect(bar.hasAttribute('hidden')).toBe(true);
      expect(bar.querySelector('p')!.text).toBe('Save your answers in this browser? They stay on this device and nothing is sent to anyone else.');
      expect(bar.querySelectorAll('button').map((b) => [b.getAttribute('data-consent-action'), b.text])).toEqual([
        ['save', 'Save'],
        ['decline', "Don't save"],
      ]);
      const notice = doc.querySelector('.docsi-consent-notice')!;
      expect(notice.hasAttribute('hidden')).toBe(true);
      expect(notice.text).toContain('Not saved: your answers are lost when you leave.');
      expect(notice.querySelectorAll('button').map((b) => b.getAttribute('data-consent-action'))).toEqual(['allow', 'hide']);
      expect(`${bar.text} ${notice.text}`.toLowerCase()).not.toContain('cookie');
    });
  }

  it('on step pages the notice sits right under the profile summary', () => {
    const html = raw(STEP1);
    const summary = html.indexOf('<docsi-profile-summary');
    const notice = html.indexOf('class="docsi-consent-notice"');
    expect(summary).toBeGreaterThan(0);
    expect(notice).toBeGreaterThan(summary);
    expect(notice).toBeLessThan(html.indexOf('class="docsi-body'));
  });
});

describe('guide navigation', () => {
  const pagination = (rel: string) => {
    const doc = page(rel);
    const link = (r: string) => {
      const a = doc.querySelector(`.pagination-links a[rel="${r}"]`);
      return a ? [a.getAttribute('href'), a.querySelector('.link-title')!.text.trim()] : null;
    };
    return { prev: link('prev'), next: link('next') };
  };

  it('the guide index has no Previous; its Next is the first step', () => {
    expect(pagination(GUIDE)).toEqual({ prev: null, next: ['/kit/step-01-unpack/', 'Unpack the kit'] });
    expect(pagination('other/index.html')).toEqual({ prev: null, next: ['/other/other-01-paint/', 'Paint the case'] });
  });

  it('steps lead to their neighbours; the first back to the guide index', () => {
    expect(pagination(STEP1)).toEqual({ prev: ['/kit/', 'Kit guide'], next: ['/kit/step-02-probe/', 'Fit the temperature probe'] });
    expect(pagination(STEP3)).toEqual({ prev: ['/kit/step-02-probe/', 'Fit the temperature probe'], next: ['/kit/step-04-unclosed/', 'A body with an unclosed block'] });
  });

  it('the last step leads to the sidebar entry after the guide (its title as label)', () => {
    expect(pagination(STEP4)).toEqual({ prev: ['/kit/step-03-finish/', 'Finish the build'], next: ['/protocol/', 'Kit protocol'] });
  });

  it('the sidebar keeps its guide links', () => {
    expect(page(STEP1).querySelector('.docsi-sidebar .docsi-guide-title')!.getAttribute('href')).toBe('/kit/');
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
    expect(supplierLabels(model)).toEqual({ 'shop-a': 'Shop A kit', 'shop-b': 'Shop B', diy: 'Sourced myself from the BoM' });
  });

  it('plainMailto', () => {
    expect(plainMailto({ name: 'X' })).toBeUndefined();
    expect(plainMailto({ name: 'X', email: 'x@y.invalid' })).toBe('mailto:x@y.invalid');
    expect(plainMailto({ name: 'X', email: 'x@y.invalid', subject: 'Hi there' }, 'Step')).toBe('mailto:x@y.invalid?subject=Hi%20there%3A%20Step');
  });

  it('siteHref puts root-relative links under the site base', () => {
    expect(siteHref('/MEP/', '/')).toBe('/MEP/');
    expect(siteHref('/MEP/', '/docs/')).toBe('/docs/MEP/');
    expect(siteHref('https://x.example/a', '/docs/')).toBe('https://x.example/a');
    expect(siteHref('//cdn.example/a', '/docs/')).toBe('//cdn.example/a');
    expect(siteHref('bom.html', '/docs/')).toBe('bom.html');
  });

  it('guideIndexPagination: no prev; the first step next', () => {
    const steps = stepsForGuide(model, 'kit');
    const guide = model.config.guides[0]!;
    expect(guideIndexPagination(guide, steps)).toEqual({ prev: false, next: { link: '/kit/step-01-unpack/', label: 'Unpack the kit' } });
    expect(guideIndexPagination(guide, steps.slice(1), '/d/')).toEqual({ prev: false, next: { link: '/d/kit/step-02-probe/', label: 'Fit the temperature probe' } });
    expect(guideIndexPagination(guide, [])).toEqual({ prev: false, next: false });
  });

  it('stepPagination: neighbours, the guide index first, the sidebar target last', () => {
    const steps = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    const guide = { base: '/g', title: 'Guide' };
    expect(stepPagination(guide, steps, 'a')).toEqual({ prev: { link: '/g/', label: 'Guide' }, next: { link: '/g/b/', label: 'B' } });
    expect(stepPagination(guide, steps, 'b', '/', { link: '/g/protocol/', label: 'Protocol' })).toEqual({
      prev: { link: '/g/a/', label: 'A' },
      next: { link: '/g/protocol/', label: 'Protocol' },
    });
    expect(stepPagination(guide, steps, 'b').next).toBe(false);
  });

  it('sidebarEntryAfter finds the entry after the guide\'s own, through groups', () => {
    const sidebar = [
      { label: 'Aseptic', items: [{ label: 'Assembly', link: '/AEP/' }, { slug: 'aep/protocol' }, { label: 'BoM', link: 'https://x.example/bom' }] },
      { label: 'Mixed', items: [{ label: 'Assembly', link: '/MEP' }, { label: 'Protocol', slug: 'mep/protocol' }] },
      { label: 'Budget', items: [{ label: 'Assembly', link: '/BAEP/' }] },
      { label: 'After', items: ['after/page'] },
      { label: 'Auto', link: '/auto/' },
      { label: 'Generated', autogenerate: { directory: 'x' } },
    ];
    expect(sidebarEntryAfter(sidebar, '/AEP/')).toEqual({ slug: 'aep/protocol' });
    expect(sidebarEntryAfter(sidebar, '/MEP/')).toEqual({ slug: 'mep/protocol', label: 'Protocol' });
    expect(sidebarEntryAfter(sidebar, '/BAEP/')).toEqual({ slug: 'after/page' });
    expect(sidebarEntryAfter(sidebar, '/aep/protocol/')).toBeUndefined();
    expect(sidebarEntryAfter(sidebar, '/auto/')).toBeUndefined();
    expect(sidebarEntryAfter(sidebar, '/none/')).toBeUndefined();
    expect(sidebarEntryAfter(undefined, '/AEP/')).toBeUndefined();
    expect(sidebarEntryAfter([{ label: 'A', link: '/a/' }, { label: 'B', link: '/b/#x' }], '/a')).toEqual({ link: '/b/#x', label: 'B' });
  });

  it('sidebarTargetHref and slugLabel', () => {
    expect(sidebarTargetHref({ slug: 'aep/protocol' })).toBe('/aep/protocol/');
    expect(sidebarTargetHref({ slug: 'aep/protocol' }, '/docs/')).toBe('/docs/aep/protocol/');
    expect(sidebarTargetHref({ slug: 'index' })).toBe('/');
    expect(sidebarTargetHref({ link: '/b/#x', label: 'B' }, '/docs/')).toBe('/docs/b/#x');
    expect(sidebarTargetHref({ link: 'https://x.example/', label: 'X' }, '/docs/')).toBe('https://x.example/');
    expect(slugLabel('aep/protocol')).toBe('Protocol');
    expect(slugLabel('getting-started')).toBe('Getting started');
  });

  it('olderVideoSentence names the old and current versions', () => {
    const pin = (component: string, shot_with: string, current: string) => ({ component, shot_with, current, changelog: [] });
    expect(olderVideoSentence({ stale_heroes: [pin('widget', '1.0.0', '1.1.0')] }, model)).toBe('This video shows Widget v1.0.0 where your kit has Widget v1.1.0.');
    expect(olderVideoSentence({ stale_heroes: [pin('widget', '1.0.0', '1.1.0'), pin('probe', '0.9.0', '1.0.0')] }, model)).toBe(
      'This video shows Widget v1.0.0 and Temperature probe v0.9.0 where your kit has Widget v1.1.0 and Temperature probe v1.0.0.',
    );
  });

  it('the fixture has a body problem that check reports and the build tolerates', () => {
    expect(model.problems).toEqual([]);
    expect(model.bodyProblems!.map((p) => `${p.file}:${p.path}`)).toEqual(['docs/steps/step-04-unclosed.md:body.line.9']);
  });
});

// ---------------------------------------------------------------------------
// task_022: glossary tooltips, asides, readable summary labels, guide-scoped
// profile items, the guide index list, narrow receipts

const OTHER_GUIDE = 'other/index.html';
const OTHER_STEP = 'other/other-01-paint/index.html';

describe('glossary tooltips', () => {
  const terms = (el: HTMLElement) => el.querySelectorAll('button.docsi-term').map((b) => b.text);

  it('the first occurrence of each term in the body is a button with its tip', () => {
    const body = page(STEP1).querySelector('.docsi-body')!;
    expect(terms(body)).toEqual(['tray', 'bag', 'widgets']);
    const button = body.querySelector('button.docsi-term')!;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('data-tip')).toBe("A shallow box that keeps one unit's parts together.");
    const described = page(STEP1).querySelector(`#${button.getAttribute('aria-describedby')}`)!;
    expect(described.classList.contains('docsi-term-tip')).toBe(true);
    expect(described.text).toBe("A shallow box that keeps one unit's parts together.");
  });

  it('without JavaScript the tip is a title attribute; no popover markup is rendered', () => {
    const html = raw(STEP1);
    for (const b of parse(html).querySelectorAll('button.docsi-term')) expect(b.getAttribute('title')).toBe(b.getAttribute('data-tip'));
    expect(parse(html).querySelector('.docsi-tip')).toBeNull();
  });

  it('a read-more link travels with the term', () => {
    const widget = page(STEP3).querySelector('.docsi-body button.docsi-term')!;
    expect(widget.text).toBe('widgets');
    expect(widget.getAttribute('data-link')).toBe('https://widgets.example/about');
  });

  it('only the first occurrence per block; never in headings, code, links or summaries', () => {
    const doc = page(STEP3);
    expect(terms(doc.querySelector('.docsi-body')!)).toEqual(['widgets']);
    expect(doc.querySelectorAll('h1 .docsi-term, h2 .docsi-term, code .docsi-term, a .docsi-term, summary .docsi-term, .docsi-when-label .docsi-term')).toHaveLength(0);
  });

  it('each check is its own block: question and issues', () => {
    const doc = page(STEP3);
    expect(terms(doc.querySelector('li[data-check="rigid"]')!)).toEqual(['widgets']);
    expect(terms(doc.querySelector('li[data-check="probe-seated"]')!)).toEqual(['probe']);
    expect(terms(doc.querySelector('li[data-check="config"]')!)).toEqual(['widget']);
  });

  it('the receipt notes are a block of their own', () => {
    const note = page(STEP1).querySelector('.docsi-receipt-static tr[data-component="spares-bag"] .docsi-receipt-note')!;
    expect(terms(note)).toEqual(['Bag']);
  });

  it('term ids are unique on the page', () => {
    for (const rel of [STEP1, STEP3]) {
      const ids = page(rel).querySelectorAll('.docsi-term-tip').map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThan(0);
    }
  });

  it('the popover script is registered on step pages and stays under 2 KB minified', async () => {
    const { build } = await import('esbuild');
    const out = await build({ entryPoints: [path.join(PKG_ROOT, 'src/elements/glossary.ts')], bundle: true, minify: true, write: false, format: 'esm' });
    expect(out.outputFiles[0]!.contents.byteLength).toBeLessThan(2048);
    const scripts = page(STEP1)
      .querySelectorAll('script[type="module"][src]')
      .map((s) => fs.readFileSync(path.join(DIST, s.getAttribute('src')!.replace(/^\//, '')), 'utf8'));
    expect(scripts.some((c) => c.includes('docsi-term') && c.includes('docsi-tip'))).toBe(true);
  });
});

describe('check questions', () => {
  it('inline code renders as code, not backticks; the raw question travels for the email', () => {
    const li = page(STEP3).querySelector('li[data-check="config"]')!;
    const q = li.querySelector('.docsi-check-q')!;
    expect(q.querySelector('code')!.text).toBe('config.ini');
    expect(q.text).not.toContain('`');
    expect(li.getAttribute('data-question')).toBe('Does `config.ini` list every widget?');
    expect(li.querySelector('.docsi-check-issues strong code')!.text).toBe('config.ini');
  });
});

describe('asides', () => {
  it(':::tip[title] and :::note render as Starlight asides', () => {
    const body = page(STEP1).querySelector('.docsi-body')!;
    const tip = body.querySelector('aside.starlight-aside.starlight-aside--tip')!;
    expect(tip.getAttribute('aria-label')).toBe('Sort first');
    const title = tip.querySelector('p.starlight-aside__title')!;
    expect(title.getAttribute('aria-hidden')).toBe('true');
    expect(title.querySelector('svg.starlight-aside__icon')!.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(title.text.trim()).toBe('Sort first');
    expect(visibleText(tip.querySelector('.starlight-aside__content')!).trim()).toContain('Lay the widgets out before you count them.');
    const note = body.querySelector('aside.starlight-aside--note')!;
    expect(note.getAttribute('aria-label')).toBe('Note');
    expect(note.querySelector('.starlight-aside__title')!.text.trim()).toBe('Note');
  });

  it('a title may carry inline Markdown', () => {
    const caution = page(STEP3).querySelector('.docsi-body aside.starlight-aside--caution')!;
    expect(caution.getAttribute('aria-label')).toBe('Mind the edge');
    expect(caution.querySelector('.starlight-aside__title code')!.text).toBe('edge');
  });

  it('safety is a danger aside titled Safety, at the top of the step body (task_023)', () => {
    const html = raw(STEP3);
    const aside = parse(html).querySelector('.docsi-safety aside.starlight-aside--danger')!;
    expect(aside.getAttribute('aria-label')).toBe('Safety');
    expect(aside.querySelector('.starlight-aside__content')!.text.trim()).toBe('Unplug before you finish.');
    const safety = html.indexOf('class="docsi-safety"');
    expect(html.indexOf('<h1')).toBeLessThan(safety);
    expect(safety).toBeLessThan(html.indexOf('class="docsi-body'));
    expect(safety).toBeLessThan(html.indexOf('<docsi-checks'));
  });

  it('the icons are Starlight\'s own', async () => {
    const icons = (await import(path.join(REPO_ROOT, 'node_modules/@astrojs/starlight/dist/components-internals/Icons.js'))) as { Icons: Record<string, string> };
    for (const variant of ASIDE_VARIANTS) expect(ASIDE_ICONS[variant]).toBe(icons.Icons[ASIDE_ICON_NAMES[variant]]);
  });

  it('text that merely looks like a directive is kept as written', async () => {
    const html = await renderMarkdown('At 10:30, see a:b and :abbr[x]{y=1}.\n\n::leaf\n');
    expect(html).toContain('<p>At 10:30, see a:b and :abbr[x]{y=1}.</p>');
    expect(html).toContain('<p>::leaf</p>');
  });

  it('asideMarkdown fences outlast colons in the body', async () => {
    const md = asideMarkdown('danger', 'Safety', 'Mind the :::fence');
    expect(md.startsWith('::::danger[Safety]\n')).toBe(true);
    expect(await renderMarkdown(md)).toContain('Mind the :::fence');
  });
});

describe('readable labels', () => {
  it('Only-with labels use the short label; unit labels read as counts', () => {
    expect(page(STEP2).querySelector('.docsi-step-condition')!.text).toBe('Only with temperature upgrade');
    expect(page(GUIDE).querySelector('li[data-step="step-02-probe"] .docsi-when-inline')!.text).toBe('Only with temperature upgrade');
  });

  it('the profile JSON carries short and unit labels for the summary bar', () => {
    const items = JSON.parse(page(STEP1).querySelector('script[data-docsi-profile]')!.text) as Array<Record<string, unknown>>;
    expect(items.find((i) => i.id === 'temp-kit')).toMatchObject({ short: 'temperature upgrade' });
    expect(items.find((i) => i.id === 'units')).toMatchObject({ unit_label: 'unit', unit_label_plural: 'units' });
  });

  it('part categories are lower-case small text', () => {
    expect(page(STEP3).querySelector('.docsi-parts .docsi-cat')!.text).toBe('part');
    const css = fs.readFileSync(path.join(PKG_ROOT, 'src/styles/docsandeye.css'), 'utf8');
    expect(css).toMatch(/\.docsi-cat \{[^}]*text-transform: lowercase;/);
  });
});

describe('profile items scoped to guides', () => {
  const ids = (rel: string) => (JSON.parse(page(rel).querySelector('script[data-docsi-profile]')!.text) as Array<{ id: string }>).map((i) => i.id);

  it('each guide\'s pages carry only its questions', () => {
    expect(ids(GUIDE)).toEqual(['build', 'units', 'temp-kit', 'supplier']);
    expect(ids(STEP1)).toEqual(['build', 'units', 'temp-kit', 'supplier']);
    expect(ids(OTHER_GUIDE)).toEqual(['build', 'units', 'supplier', 'colour']);
    expect(ids(OTHER_STEP)).toEqual(['build', 'units', 'supplier', 'colour']);
  });

  it('the form shows only the guide\'s questions', () => {
    const fields = (rel: string) => page(rel).querySelectorAll('docsi-profile [data-profile-field]').map((f) => f.getAttribute('data-profile-field'));
    expect(fields(OTHER_GUIDE)).toEqual(['build', 'units', 'supplier', 'colour']);
  });

  it('a condition on a scoped item reads with its labels', () => {
    const doc = page(OTHER_STEP);
    expect(doc.querySelector('.docsi-body .docsi-when-label')!.text).toBe('Only if: colour: Red case');
    expect(doc.querySelector('.docsi-parts li[data-component="widget"] .docsi-when-inline')!.text).toBe('Only if: colour: Red case');
  });
});

describe('guide index list', () => {
  it('each step row has its number, title and parts count', () => {
    const rows = page(GUIDE).querySelectorAll('.docsi-guide-steps li');
    expect(rows.map((li) => [li.querySelector('.docsi-step-num')!.text.trim(), li.querySelector('a')!.text.trim(), li.querySelector('.docsi-parts-count')!.text.trim()])).toEqual([
      ['1', 'Unpack the kit', '3 parts'],
      ['2', 'Fit the temperature probe', '1 part'],
      ['3', 'Finish the build', '2 parts'],
      ['4', 'A body with an unclosed block', '0 parts'],
    ]);
  });
});

describe('receipt on narrow screens', () => {
  it('the stylesheet lays rows out as one line below 40rem; "Not in your package" is a closed details with a count', () => {
    const css = fs.readFileSync(path.join(PKG_ROOT, 'src/styles/docsandeye.css'), 'utf8');
    const narrow = css.slice(css.indexOf('@media (max-width: 40rem)'));
    expect(narrow).toMatch(/\.docsi-receipt-table tr \{\s*display: flex;/);
    const src = fs.readFileSync(path.join(PKG_ROOT, 'src/elements/docsi-receipt.ts'), 'utf8');
    expect(src).toContain("el('details', undefined, 'docsi-receipt-elsewhere')");
    expect(src).toContain('Not in your package — source these yourself (${r.elsewhere.length})');
  });
});

// ---------------------------------------------------------------------------
// task_023: review follow-ups — glossary exclude, maintainer-only drafts,
// inline Markdown in checks, safety first, label links, companion pages,
// option spacing, canonical URLs

describe('task_023: glossary exclude', () => {
  it('an occurrence inside an excluded phrase is skipped; the next one is linked', () => {
    const body = page(STEP2).querySelector('.docsi-body')!;
    const buttons = body.querySelectorAll('button.docsi-term');
    expect(buttons.map((b) => b.text)).toEqual(['probe']);
    expect(body.innerHTML).toContain('Uncoil the probe lead. Push the <button');
  });
});

describe('task_023: draft material is maintainer-only', () => {
  const note = (doc: HTMLElement) => doc.querySelector('.docsi-receipt-static tr[data-component="bracket"] .docsi-receipt-note');

  it('a DRAFT: receipt note is left out for readers', () => {
    expect(page(STEP1).querySelector('.docsi-receipt-static tr[data-component="bracket"]')).toBeTruthy();
    expect(note(page(STEP1))).toBeNull();
    expect(raw(STEP1)).not.toContain('confirm the count');
  });

  it('a maintainer build shows it in full; other notes are shown in both', () => {
    expect(note(maintainerPage(STEP1))!.text).toBe('DRAFT: confirm the count with Bracket Co');
    for (const doc of [page(STEP1), maintainerPage(STEP1)]) {
      expect(visibleText(doc.querySelector('tr[data-component="spares-bag"] .docsi-receipt-note')!)).toBe('Bag B, shared across units');
    }
  });

  it('guideReceiptItems keeps DRAFT notes only for a maintainer', async () => {
    const model = await loadProject(PROJECT_DIR);
    const bracket = (maintainer: boolean) => guideReceiptItems(model, 'kit', maintainer).find((i) => i.component === 'bracket')!;
    expect(bracket(false).note).toBeUndefined();
    expect(bracket(true).note).toBe('DRAFT: confirm the count with Bracket Co');
    expect(guideReceiptItems(model, 'kit').find((i) => i.component === 'bracket')!.note).toBeUndefined();
  });
});

describe('task_023: inline Markdown in checks', () => {
  it('issues render emphasis, bold and links; no block elements', () => {
    const li = page(STEP3).querySelector('li[data-check="rigid"] details.docsi-check-issues li')!;
    expect(li.querySelector('strong em')!.text).toBe('wobbles');
    expect(li.querySelectorAll('strong').map((s) => s.text)).toContain('by hand');
    const a = li.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://widgets.example/torque');
    expect(a.text).toBe('torque table');
    expect(li.querySelectorAll('p, ul, ol, h1, h2, h3, blockquote')).toHaveLength(0);
    expect(li.text).not.toContain('**');
    expect(li.text).not.toContain('](');
  });

  it('code spans still render', () => {
    expect(page(STEP3).querySelector('li[data-check="config"] .docsi-check-q code')!.text).toBe('config.ini');
  });
});

describe('task_023: companion pages of a guide', () => {
  it('the guide\'s sidebar group lists its pages at Starlight\'s own (lower-case) href', () => {
    for (const rel of [GUIDE, STEP1]) {
      const links = page(rel).querySelectorAll('.docsi-sidebar-guide .docsi-guide-pages a');
      expect(links.map((a) => [a.text.trim(), a.getAttribute('href')])).toEqual([['Wiring notes', '/kit/wiring/']]);
    }
    expect(fs.existsSync(path.join(DIST, 'kit/wiring/index.html'))).toBe(true);
  });

  it('the pages follow the steps; "Other guides" is kept', () => {
    const nav = page(STEP1).querySelector('nav.docsi-sidebar')!.outerHTML;
    expect(nav.indexOf('class="docsi-steps"')).toBeLessThan(nav.indexOf('class="docsi-guide-pages"'));
    expect(page(STEP1).querySelector('.docsi-sidebar-others .docsi-guides a')!.getAttribute('href')).toBe('/other/');
    expect(page(OTHER_STEP).querySelector('.docsi-guide-pages')).toBeNull();
  });

  it('guidePageLinks resolves a slug to the content entry case-insensitively', () => {
    const ids = ['aep/protocol', 'kit/wiring', 'notes/index', 'index'];
    expect(guidePageLinks([{ label: 'Protocol', slug: 'AEP/protocol' }], ids)).toEqual([{ label: 'Protocol', href: '/aep/protocol/', found: true }]);
    expect(guidePageLinks([{ label: 'W', slug: '/Kit/Wiring/' }], ids, '/docs/')).toEqual([{ label: 'W', href: '/docs/kit/wiring/', found: true }]);
    expect(guidePageLinks([{ label: 'N', slug: 'notes' }], ids)).toEqual([{ label: 'N', href: '/notes/', found: true }]);
    expect(guidePageLinks([{ label: 'Home', slug: 'index' }], ids)).toEqual([{ label: 'Home', href: '/', found: true }]);
    expect(guidePageLinks([{ label: 'Gone', slug: 'Missing/Page' }], ids)).toEqual([{ label: 'Gone', href: '/missing/page/', found: false }]);
    expect(guidePageLinks(undefined, ids)).toEqual([]);
  });
});

describe('task_023: option spacing', () => {
  it('a choice list is a column at normal line spacing (0.35rem gap, no extra margin)', () => {
    const css = fs.readFileSync(path.join(PKG_ROOT, 'src/styles/docsandeye.css'), 'utf8');
    expect(css).toMatch(/fieldset\.docsi-profile-field \{[^}]*flex-direction: column;[^}]*gap: 0\.35rem;/);
    expect(css).toMatch(/\.docsi-profile-option \{[^}]*gap: 0\.35rem;[^}]*margin: 0;/);
    expect(css).not.toMatch(/\.docsi-profile-option \{[^}]*flex-basis/);
    // Options are spans, which Starlight's content spacing (`:not(span) + :not(span)`) leaves alone.
    expect(page(GUIDE).querySelectorAll('fieldset[data-profile-field="supplier"] > span.docsi-profile-option')).toHaveLength(3);
  });
});

describe('task_023: canonical URLs and the sitemap', () => {
  function htmlFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? htmlFiles(full) : e.name.endsWith('.html') ? [full] : [];
    });
  }
  /** Whether a URL is served by a built file: `/a/` by `a/index.html` (or `a.html`, as `404.html` is), `/a.xml` by itself. */
  const exists = (url: string) => {
    const pathname = decodeURIComponent(new URL(url).pathname);
    const candidates = pathname.endsWith('/') ? [`${pathname}index.html`, `${pathname.slice(0, -1)}.html`] : [pathname];
    return candidates.some((c) => fs.existsSync(path.join(DIST, c)));
  };

  it('every canonical URL in the built site points at an existing file', () => {
    const canonicals = htmlFiles(DIST).flatMap((f) => parse(fs.readFileSync(f, 'utf8')).querySelectorAll('link[rel="canonical"]').map((l) => l.getAttribute('href')!));
    expect(canonicals.length).toBeGreaterThan(5);
    expect(canonicals).toContain('https://docsandeye.example/kit/wiring/');
    expect(canonicals.filter((url) => !exists(url))).toEqual([]);
  });

  it('every sitemap URL points at an existing file', () => {
    const locs = [...fs.readFileSync(path.join(DIST, 'sitemap-0.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(locs).toContain('https://docsandeye.example/kit/wiring/');
    expect(locs.filter((url) => !exists(url))).toEqual([]);
  });
});

describe('page descriptions: description, OpenGraph and Twitter tags', () => {
  const meta = (rel: string, selector: string) => page(rel).querySelector(selector)?.getAttribute('content');

  it('a guide page is described as "<title>: <N> steps."', () => {
    expect(meta(GUIDE, 'meta[name="description"]')).toBe('Kit guide: 4 steps.');
    expect(meta(GUIDE, 'meta[property="og:description"]')).toBe('Kit guide: 4 steps.');
    expect(meta('other/index.html', 'meta[name="description"]')).toBe('Other guide: 1 step.');
  });

  it("a step page is described by its body's first paragraph, Markdown stripped", () => {
    expect(meta(STEP1, 'meta[name="description"]')).toBe('Open the box and lay the parts out.');
    expect(meta(STEP1, 'meta[property="og:description"]')).toBe('Open the box and lay the parts out.');
    expect(meta(STEP2, 'meta[name="description"]')).toBe('Uncoil the probe lead. Push the probe into its socket.');
    expect(meta(STEP3, 'meta[property="og:description"]')).toBe('Fit the widgets.');
  });

  it('Starlight adds the OpenGraph title and Twitter card; no per-step image', () => {
    expect(meta(STEP1, 'meta[property="og:title"]')).toBe('Unpack the kit');
    expect(meta(STEP1, 'meta[name="twitter:card"]')).toBeTruthy();
    expect(page(STEP1).querySelector('meta[property="og:image"]')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// task_024: non-leading multiple-choice checks

describe('task_024: multiple-choice checks', () => {
  const model = () => loadProject(PROJECT_DIR);
  const choice = (rel: string, id: string) => page(rel).querySelector(`li.docsi-check-choice[data-check="${id}"]`)!;
  const labels = (li: HTMLElement) => li.querySelectorAll('button.docsi-check-option .docsi-check-label').map((l) => l.text.trim());

  it('options render in the placed order as identical, inert buttons with opaque tokens', () => {
    const li = choice(STEP1, 'laid-out');
    const placed = model().steps.get('step-01-unpack')!.checks!.find((c) => c.id === 'laid-out')!.options!;
    expect(labels(li)).toEqual(placed.map((o) => o.label));
    const buttons = li.querySelectorAll('button.docsi-check-option');
    expect(buttons).toHaveLength(3);
    for (const b of buttons) {
      expect(b.getAttribute('type')).toBe('button');
      expect(b.getAttribute('aria-pressed')).toBe('false');
      expect(b.hasAttribute('disabled')).toBe(true);
      expect(b.getAttribute('class')).toBe('docsi-check-option');
      expect(b.getAttribute('data-option')).toMatch(/^[0-9a-f]{8}$/);
    }
    // Every option carries exactly the same attribute names: nothing marks the right one.
    const names = buttons.map((b) => Object.keys(b.attributes).sort().join(','));
    expect(new Set(names).size).toBe(1);
    expect(li.getAttribute('data-key')).toBe(answerKey('step-01-unpack', 'laid-out', optionToken('laid-out', 'In one pile per unit')));
    expect(raw(STEP1)).not.toMatch(/data-correct|class="[^"]*correct/);
    expect(li.querySelector('.docsi-check-options')!.getAttribute('aria-labelledby')).toBe(li.querySelector('.docsi-check-q')!.getAttribute('id'));
  });

  it('an image option is a thumbnail with its alt, copied under /_docsandeye/checks/', () => {
    const img = choice(STEP1, 'laid-out').querySelector('img.docsi-check-thumb')!;
    expect(img.getAttribute('src')).toBe('/_docsandeye/checks/docs/img/parts-heap.svg');
    expect(img.getAttribute('alt')).toBe('Every part in a single heap');
    expect(fs.existsSync(path.join(DIST, '_docsandeye/checks/docs/img/parts-heap.svg'))).toBe(true);
    expect(choice(STEP3, 'frame-feet').querySelector('img')).toBeFalsy();
  });

  it('fixes are hidden per wrong option; no fix names the right one', () => {
    const li = choice(STEP1, 'laid-out');
    const fixes = li.querySelectorAll('.docsi-check-fix');
    expect(fixes.map((f) => f.getAttribute('data-for'))).toEqual(
      model().steps.get('step-01-unpack')!.checks!.find((c) => c.id === 'laid-out')!.options!.filter((o) => o.fix).map((o) => optionToken('laid-out', o.label)),
    );
    for (const f of fixes) expect(f.hasAttribute('hidden')).toBe(true);
    expect(li.querySelector('.docsi-check-feedback')!.getAttribute('role')).toBe('status');
    expect(li.querySelector('.docsi-check-contact')!.hasAttribute('hidden')).toBe(true);
  });

  it('without JavaScript: a closed <details> reveals the answer and what to do for each wrong option', () => {
    const details = choice(STEP3, 'frame-feet').querySelector('details.docsi-check-reveal')!;
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.querySelector('summary')!.text).toBe('Show the answer');
    expect(details.querySelector('p strong')!.text).toBe('Touching the table');
    expect(details.querySelectorAll('li').map((l) => l.text.replace(/\s+/g, ' ').trim())).toEqual([
      'If you see Pointing up: Turn the frame over.',
      'If you see Pointing sideways: Rotate the frame a quarter turn.',
    ]);
  });

  it('the correct position cycles through the guide: the two fixture checks differ', () => {
    const at = (rel: string, id: string) => {
      const li = choice(rel, id);
      return li.querySelectorAll('button.docsi-check-option').findIndex((b) => answerKey(li.closest('docsi-checks')!.getAttribute('data-step')!, id, b.getAttribute('data-option')!) === li.getAttribute('data-key'));
    };
    const first = at(STEP1, 'laid-out');
    const second = at(STEP3, 'frame-feet');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBe((first + 1) % 3);
  });

  it('legacy yes/no checks on the same page render as before', () => {
    const li = page(STEP1).querySelector('li[data-check="count"]')!;
    expect(li.classList.contains('docsi-check-choice')).toBe(false);
    expect(li.querySelector('.docsi-check-answer')!.hasAttribute('hidden')).toBe(true);
    expect(li.querySelector('.docsi-check-options')).toBeFalsy();
    expect(li.querySelector('details.docsi-check-reveal')).toBeFalsy();
  });

  it('the guide list ticks option checks like yes/no ones', () => {
    const li = page(GUIDE).querySelector('.docsi-guide-steps li[data-step="step-01-unpack"]')!;
    expect(json(li, 'data-checks')).toEqual([{ id: 'count' }, { id: 'dry' }, { id: 'laid-out' }]);
  });
});
