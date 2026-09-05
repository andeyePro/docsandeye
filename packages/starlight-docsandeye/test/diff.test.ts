/**
 * Tester suite for task_011 (AC6, AC7, AC8, part of AC9) — `<docsi-diff>` old
 * vs new geometry inside the STALE details.
 *
 * Independence note: every expected value below (markup, URLs, captions,
 * link text) is taken from spec.md's normative `<docsi-diff>` example and the
 * fixture YAML/JSON files, never from running the plugin and reading back
 * whatever it produced.
 *
 * `fixtures/site` is ALSO built by `build.test.ts`'s own `beforeAll` (and by
 * `video.test.ts`'s own scratch copy). Building the very same fixture
 * directory concurrently races Vite's dependency cache (see video.test.ts's
 * comment for the empirically observed failure modes), so this file builds
 * its own ephemeral sibling copy — a distinct name from video.test.ts's own
 * scratch dir, so neither file's `beforeAll`/`afterAll` ever touches a
 * directory the other is using.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { diffLayout } from '../src/elements/docsi-diff.ts';

const execFileP = promisify(execFile);
const BUILD_TIMEOUT = 600_000;

vi.setConfig({ testTimeout: BUILD_TIMEOUT, hookTimeout: BUILD_TIMEOUT });

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = path.join(PKG_ROOT, 'fixtures');
const SITE_SRC_DIR = path.join(FIXTURES_DIR, 'site');
const SITE_SCRATCH_DIR = path.join(FIXTURES_DIR, 'site-tester-scratch-diff'); // ephemeral; never committed
const DIST = path.join(SITE_SCRATCH_DIR, 'dist');

function copyFixtureTree(src: string, dest: string): void {
  const SKIP = new Set(['node_modules', 'dist', 'dist-maintainer', '.astro']);
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyFixtureTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

let buildOk = false;

beforeAll(async () => {
  fs.rmSync(SITE_SCRATCH_DIR, { recursive: true, force: true });
  copyFixtureTree(SITE_SRC_DIR, SITE_SCRATCH_DIR);
  await execFileP('npx', ['astro', 'build'], {
    cwd: SITE_SCRATCH_DIR,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-04' },
    timeout: BUILD_TIMEOUT,
    maxBuffer: 1024 * 1024 * 64,
  });
  buildOk = true;
}, BUILD_TIMEOUT);

afterAll(() => {
  fs.rmSync(SITE_SCRATCH_DIR, { recursive: true, force: true });
});

function readHtml(relPath: string) {
  return parse(fs.readFileSync(path.join(DIST, relPath), 'utf8'));
}

function rawHtml(relPath: string): string {
  return fs.readFileSync(path.join(DIST, relPath), 'utf8');
}

describe('build succeeds', () => {
  it('fixtures/site (scratch copy) built', () => {
    expect(buildOk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC6 + AC7: the <docsi-diff> contract on step-02-cap's vid-03-old details.
// ---------------------------------------------------------------------------

describe('AC6 + AC7: <docsi-diff> for vid-03-old (top-stop 1.0.0 -> 1.3.0)', () => {
  let html: string;

  beforeAll(() => {
    html = rawHtml('AEP/step-02-cap/index.html');
  });

  it('exactly one <docsi-diff> on the page (vial-cap\'s two stale pins have no old job; CHANGED_IN_FRAME never reaches StalenessDetails)', () => {
    const doc = parse(html);
    expect(doc.querySelectorAll('docsi-diff').length).toBe(1);
  });

  it('sits inside the vid-03-old STALE video details, with data-component/data-old/data-new attributes', () => {
    const doc = parse(html);
    const details = doc.querySelectorAll('details.docsi-stale-video');
    expect(details.length).toBe(1);
    const diff = details[0]!.querySelector('docsi-diff');
    expect(diff).toBeTruthy();
    expect(diff!.getAttribute('data-component')).toBe('top-stop');
    expect(diff!.getAttribute('data-old')).toBe('1.0.0');
    expect(diff!.getAttribute('data-new')).toBe('1.3.0');
  });

  // Percent-encoded per segment, so the `@` of `<component>@<version>` is `%40`
  // in the markup; the file on disk keeps its unencoded name (see the copy-step
  // assertion below).
  it('old figure: exact caption, docsi-model data-src, and download link text/href', () => {
    const doc = parse(html);
    const diff = doc.querySelector('docsi-diff')!;
    const oldFigure = diff.querySelector('figure.docsi-diff-old');
    expect(oldFigure).toBeTruthy();
    expect(oldFigure!.querySelector('figcaption')!.text.trim()).toBe('Recorded with v1.0.0');

    const model = oldFigure!.querySelector('docsi-model')!;
    expect(model.getAttribute('data-src')).toBe('/_docsandeye/render/old/top-stop%401.0.0.glb');
    const link = model.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/_docsandeye/render/old/top-stop%401.0.0.glb');
    expect(link.text.trim()).toBe('Download the old 3D model');
  });

  it('new figure: exact caption, docsi-model data-src (the current viewer job), and download link text/href', () => {
    const doc = parse(html);
    const diff = doc.querySelector('docsi-diff')!;
    const newFigure = diff.querySelector('figure.docsi-diff-new');
    expect(newFigure).toBeTruthy();
    expect(newFigure!.querySelector('figcaption')!.text.trim()).toBe('Current v1.3.0');

    const model = newFigure!.querySelector('docsi-model')!;
    expect(model.getAttribute('data-src')).toBe('/_docsandeye/render/top-stop%401.3.0--viewer--00628eabad92.glb');
    const link = model.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/_docsandeye/render/top-stop%401.3.0--viewer--00628eabad92.glb');
    expect(link.text.trim()).toBe('Download the current 3D model');
  });

  it('document order: <docsi-diff> precedes the changelog list, which precedes the "Watch the older video" button', () => {
    const doc = parse(html);
    const details = doc.querySelector('details.docsi-stale-video')!;
    const detailsHtml = details.outerHTML;
    const diffIdx = detailsHtml.indexOf('<docsi-diff');
    const changelogIdx = detailsHtml.indexOf('class="docsi-changelog"');
    const buttonIdx = detailsHtml.indexOf('docsi-watch-older');
    expect(diffIdx).toBeGreaterThanOrEqual(0);
    expect(changelogIdx).toBeGreaterThan(diffIdx);
    expect(buttonIdx).toBeGreaterThan(changelogIdx);
  });

  it('AC7: neither figure depends on JavaScript to show its caption (raw server HTML, no script executed)', () => {
    // The whole assertion suite above reads rawHtml()/readHtml() straight off
    // disk with no JS execution, so both captions ("Recorded with v1.0.0" and
    // "Current v1.3.0") are already proven present in the light DOM; this
    // test additionally pins that the captions sit in plain <figcaption>
    // elements, not inside a <script> or template that JS would need to render.
    const doc = parse(html);
    const diff = doc.querySelector('docsi-diff')!;
    const captions = diff.querySelectorAll('figcaption');
    expect(captions.length).toBe(2);
    expect(captions.map((c) => c.text.trim())).toEqual(['Recorded with v1.0.0', 'Current v1.3.0']);
  });
});

// ---------------------------------------------------------------------------
// AC6: the old geometry copy step, and the new step-05-topstop route.
// ---------------------------------------------------------------------------

describe('AC6: static copy and the new step-05-topstop route', () => {
  it('dist/_docsandeye/render/old/top-stop@1.0.0.glb exists, byte-identical to the fixture placeholder', () => {
    const copied = path.join(DIST, '_docsandeye/render/old/top-stop@1.0.0.glb');
    expect(fs.existsSync(copied)).toBe(true);
    const fixturePath = path.join(FIXTURES_DIR, 'project/build/render/old/top-stop@1.0.0.glb');
    expect(fs.readFileSync(copied).equals(fs.readFileSync(fixturePath))).toBe(true);
  });

  it('AEP/step-05-topstop/index.html exists', () => {
    expect(fs.existsSync(path.join(DIST, 'AEP/step-05-topstop/index.html'))).toBe(true);
  });

  it('AEP/step-05-topstop renders the current top-stop viewer (no <docsi-diff>: it is not a STALE media page)', () => {
    const doc = readHtml('AEP/step-05-topstop/index.html');
    const model = doc.querySelector('docsi-model');
    expect(model).toBeTruthy();
    expect(model!.getAttribute('data-src')).toBe('/_docsandeye/render/top-stop%401.3.0--viewer--00628eabad92.glb');
    expect(doc.querySelector('docsi-diff')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// AC6: no <docsi-diff> for the component with no old-manifest job, and none
// for CHANGED_IN_FRAME media.
// ---------------------------------------------------------------------------

describe('AC6: no <docsi-diff> where there is no restored old job, or the status is not STALE', () => {
  it('vid-04-old-nogeom (hero vial-cap@1.0.0, no old-manifest entry): its details render without any <docsi-diff>', () => {
    const doc = readHtml('AEP/step-02-cap/index.html');
    const figure = doc.querySelector('[data-media="vid-04-old-nogeom"]');
    expect(figure).toBeTruthy();
    const details = figure!.closest('details.docsi-stale');
    expect(details).toBeTruthy();
    expect(details!.querySelector('docsi-diff')).toBeFalsy();
  });

  it('photo-02-cap (also hero vial-cap@1.0.0, also no old job): its details render without any <docsi-diff>', () => {
    const doc = readHtml('AEP/step-02-cap/index.html');
    const figure = doc.querySelector('[data-media="photo-02-cap"]');
    expect(figure).toBeTruthy();
    const details = figure!.closest('details.docsi-stale');
    expect(details).toBeTruthy();
    expect(details!.querySelector('docsi-diff')).toBeFalsy();
  });

  it('CHANGED_IN_FRAME vid-02-seat: not demoted into any details, and no <docsi-diff> nearby', () => {
    const doc = readHtml('AEP/step-02-cap/index.html');
    const video = doc.querySelector('docsi-video[data-media="vid-02-seat"]');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('data-status')).toBe('CHANGED_IN_FRAME');
    expect(video!.closest('details')).toBeFalsy();
    const figure = video!.closest('figure.docsi-video-figure');
    expect(figure).toBeTruthy();
    expect(figure!.querySelector('docsi-diff')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// AC8: the registering script also defines docsi-diff, and stays under 30KB
// (the two pre-existing size assertions in build.test.ts are left unchanged).
// ---------------------------------------------------------------------------

describe('AC8: element registration', () => {
  it('the registering script on step-02-cap also defines docsi-diff, and is under 30KB', () => {
    const doc = readHtml('AEP/step-02-cap/index.html');
    const scripts = doc.querySelectorAll('script[type="module"]').filter((s) => !!s.getAttribute('src'));
    const registering = scripts
      .map((s) => {
        const src = s.getAttribute('src')!;
        const filePath = path.join(DIST, src.replace(/^\//, ''));
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
        return { filePath, normalised: content.replace(/'/g, '"') };
      })
      .filter((c) =>
        ['docsi-step', 'docsi-model', 'docsi-lightbox', 'docsi-video', 'docsi-diff'].every((name) =>
          c.normalised.includes(`customElements.define("${name}"`),
        ),
      );
    expect(registering.length, 'expected exactly one module script registering all five custom elements').toBe(1);
    expect(fs.statSync(registering[0]!.filePath).size).toBeLessThan(30 * 1024);
  });
});

// ---------------------------------------------------------------------------
// AC8: diffLayout — pure unit cases, no build needed.
// ---------------------------------------------------------------------------

describe('AC8: diffLayout (pure)', () => {
  it('0 figures -> single', () => {
    expect(diffLayout(0)).toBe('single');
  });

  it('1 figure -> single', () => {
    expect(diffLayout(1)).toBe('single');
  });

  it('2 figures -> pair', () => {
    expect(diffLayout(2)).toBe('pair');
  });

  it('more than 2 figures -> pair', () => {
    expect(diffLayout(3)).toBe('pair');
  });
});
