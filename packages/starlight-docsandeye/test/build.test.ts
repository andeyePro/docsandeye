/**
 * Tester suite — build-dependent acceptance criteria. Builds the fixture
 * site exactly once (default + maintainer) plus the bad-theme site (expected
 * to fail), all in one `beforeAll`, then asserts on `dist/` with
 * node-html-parser. Raw-HTML assertions only; nothing here executes browser
 * JavaScript.
 *
 * Independence note: every expected value below (hashes, dates, versions,
 * names, wording) is taken from spec.md and the fixture YAML/Markdown files
 * — never from running the plugin and reading back whatever it produced.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';

const execFileP = promisify(execFile);
const BUILD_TIMEOUT = 600_000;

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const SITE_DIR = path.join(PKG_ROOT, 'fixtures/site');
const BAD_SITE_DIR = path.join(PKG_ROOT, 'fixtures/site-bad-theme');
const PIOREACTOR_SITE_DIR = path.join(PKG_ROOT, 'fixtures/site-pioreactor');
const DIST = path.join(SITE_DIR, 'dist');
const DIST_MAINTAINER = path.join(SITE_DIR, 'dist-maintainer');
const DIST_PIOREACTOR = path.join(PIOREACTOR_SITE_DIR, 'dist');
const DIST_PIOREACTOR_MANUAL_HEAD = path.join(PIOREACTOR_SITE_DIR, 'dist-manual-head');

let siteBuildOk = false;
let maintainerBuildOk = false;
let badThemeResult: { failed: boolean; code: number | string | null; output: string } = {
  failed: false,
  code: null,
  output: '',
};

beforeAll(async () => {
  await execFileP('npx', ['astro', 'build'], {
    cwd: SITE_DIR,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-04' },
    timeout: BUILD_TIMEOUT,
    maxBuffer: 1024 * 1024 * 64,
  });
  siteBuildOk = true;

  await execFileP('npx', ['astro', 'build', '--outDir', './dist-maintainer'], {
    cwd: SITE_DIR,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-04', DOCSANDEYE_MAINTAINER: '1' },
    timeout: BUILD_TIMEOUT,
    maxBuffer: 1024 * 1024 * 64,
  });
  maintainerBuildOk = true;

  // A site on a theme pack, built twice: once as an ordinary site (the plugin
  // is the only thing that can put the first-paint script in <head>), and once
  // with the site config adding the script itself (the plugin must not add a
  // second copy).
  await execFileP('npx', ['astro', 'build'], {
    cwd: PIOREACTOR_SITE_DIR,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-04' },
    timeout: BUILD_TIMEOUT,
    maxBuffer: 1024 * 1024 * 64,
  });

  await execFileP('npx', ['astro', 'build', '--outDir', './dist-manual-head'], {
    cwd: PIOREACTOR_SITE_DIR,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-04', DOCSANDEYE_FIXTURE_MANUAL_HEAD: '1' },
    timeout: BUILD_TIMEOUT,
    maxBuffer: 1024 * 1024 * 64,
  });

  try {
    await execFileP('npx', ['astro', 'build'], {
      cwd: BAD_SITE_DIR,
      env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-04' },
      timeout: BUILD_TIMEOUT,
      maxBuffer: 1024 * 1024 * 64,
    });
  } catch (err) {
    const e = err as { code?: number | string | null; stderr?: string; stdout?: string };
    badThemeResult = { failed: true, code: e.code ?? null, output: `${e.stdout ?? ''}\n${e.stderr ?? ''}` };
  }
}, BUILD_TIMEOUT);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readHtml(distDir: string, relPath: string) {
  return parse(fs.readFileSync(path.join(distDir, relPath), 'utf8'));
}

function rawHtml(distDir: string, relPath: string): string {
  return fs.readFileSync(path.join(distDir, relPath), 'utf8');
}

/** All file paths under `dir`, relative to `dir`, posix-separated. */
function walk(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, base));
    } else {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// AC1 (build-exit portion): astro build exit codes
// ---------------------------------------------------------------------------

describe('AC1 plugin registration: build exit codes', () => {
  it('astro build of fixtures/site exits 0', () => {
    expect(siteBuildOk).toBe(true);
  });

  it('astro build of fixtures/site-bad-theme exits non-zero with stderr containing unknown theme "nope"', () => {
    expect(badThemeResult.failed).toBe(true);
    expect(badThemeResult.code).not.toBe(0);
    expect(badThemeResult.output).toContain('unknown theme "nope"');
  });
});

// ---------------------------------------------------------------------------
// AC3: Routes
// ---------------------------------------------------------------------------

describe('AC3 routes', () => {
  const present = [
    'AEP/index.html',
    'MEP/index.html',
    'AEP/step-01-raft/index.html',
    'AEP/step-02-cap/index.html',
    'MEP/step-01-raft/index.html',
    'MEP/step-03-mep-only/index.html',
  ];

  for (const rel of present) {
    it(`dist/ contains ${rel}`, () => {
      expect(fs.existsSync(path.join(DIST, rel))).toBe(true);
    });
  }

  it('dist/ does not contain AEP/step-03-mep-only/', () => {
    expect(fs.existsSync(path.join(DIST, 'AEP/step-03-mep-only'))).toBe(false);
  });

  it('dist/ does not contain MEP/step-02-cap/', () => {
    expect(fs.existsSync(path.join(DIST, 'MEP/step-02-cap'))).toBe(false);
  });

  it('dist/ contains no step-04-orphan/ directory or file anywhere', () => {
    const files = walk(DIST);
    expect(files.some((f) => f.includes('step-04-orphan'))).toBe(false);
  });

  it('without DOCSANDEYE_MAINTAINER there is no reshoot/ directory', () => {
    expect(fs.existsSync(path.join(DIST, 'reshoot'))).toBe(false);
  });

  it('with DOCSANDEYE_MAINTAINER=1, reshoot/index.html exists', () => {
    expect(fs.existsSync(path.join(DIST_MAINTAINER, 'reshoot/index.html'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC4 + AC6: Step page markup, document order, no-JS fallback, staleness
// demotion. Combined because AC4's document-order requirement spans the same
// media pane that AC6 governs.
// ---------------------------------------------------------------------------

describe('AC4 + AC6: step-02-cap markup, document order and staleness demotion', () => {
  let html: string;

  beforeAll(() => {
    html = rawHtml(DIST, 'AEP/step-02-cap/index.html');
  });

  it('has a <docsi-step data-step="step-02-cap"> wrapper', () => {
    expect(html).toMatch(/<docsi-step[^>]*data-step="step-02-cap"/);
  });

  it('media pane: render <img> for cap-iso appears with the exact src/alt', () => {
    expect(html).toContain(
      '<img src="/_docsandeye/render/vial-cap@2.0.0--cap-iso--0fd0f88538ea.png" alt="cap-iso">',
    );
  });

  it('media pane: <docsi-model data-src="…viewer…glb"> with a Download 3D model light-DOM link', () => {
    const doc = parse(html);
    const model = doc.querySelector('docsi-model');
    expect(model).toBeTruthy();
    expect(model!.getAttribute('data-src')).toBe(
      '/_docsandeye/render/vial-cap@2.0.0--viewer--d2ced720dce2.glb',
    );
    const link = model!.querySelector('a');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toBe('/_docsandeye/render/vial-cap@2.0.0--viewer--d2ced720dce2.glb');
    expect(link!.text.trim()).toBe('Download 3D model');
  });

  it('media pane document order: render, then viewer, then in-flow vid-02-seat, then stale photo-02-cap details', () => {
    const renderIdx = html.indexOf('vial-cap@2.0.0--cap-iso--0fd0f88538ea.png');
    const modelIdx = html.indexOf('<docsi-model');
    const videoIdx = html.indexOf('data-media="vid-02-seat"');
    const staleIdx = html.indexOf('data-media="photo-02-cap"');
    expect(renderIdx).toBeGreaterThanOrEqual(0);
    expect(modelIdx).toBeGreaterThan(renderIdx);
    expect(videoIdx).toBeGreaterThan(modelIdx);
    expect(staleIdx).toBeGreaterThan(videoIdx);
  });

  it('STALE photo-02-cap: <details class="docsi-stale"> summary text is exact', () => {
    const doc = parse(html);
    const details = doc.querySelector('details.docsi-stale');
    expect(details).toBeTruthy();
    const summary = details!.querySelector('summary');
    expect(summary?.text.trim()).toBe(
      'A photo exists for this step, but Vial Cap has changed since it was taken (v1.0.0 → v2.0.0)',
    );
  });

  it('STALE photo-02-cap: the 2.0.0 changelog <li> appears before the <img>', () => {
    const detailsHtml = parse(html).querySelector('details.docsi-stale')!.outerHTML;
    const liIdx = detailsHtml.indexOf('<li>');
    const imgIdx = detailsHtml.indexOf('<img');
    expect(liIdx).toBeGreaterThanOrEqual(0);
    expect(imgIdx).toBeGreaterThan(liIdx);
    const li = parse(detailsHtml).querySelector('li');
    expect(li?.text).toContain('2.0.0');
    expect(li?.text).toContain('Port layout rework.');
  });

  it('CHANGED_IN_FRAME vid-02-seat: <docsi-video> facade (encoded contract) in normal flow, followed by a docsi-note mentioning Vial Cap', () => {
    // v0.2: the v0.1 placeholder <img data-docsi-video="reserved"> is gone;
    // the step now carries the real <docsi-video> facade (see video.test.ts
    // AC2 for the full encoded-contract assertions). This test only re-checks
    // the parts of the v0.1 assertion that still apply: normal flow (not
    // demoted into a <details>) and the docsi-note that follows it.
    const doc = parse(html);
    const video = doc.querySelector('docsi-video[data-media="vid-02-seat"]');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('data-status')).toBe('CHANGED_IN_FRAME');
    expect(video!.closest('details')).toBeFalsy();
    expect(doc.querySelector('[data-docsi-video]')).toBeFalsy();
    const figure = video!.closest('figure.docsi-video-figure');
    expect(figure).toBeTruthy();
    const note = figure!.querySelector('p.docsi-note');
    expect(note).toBeTruthy();
    expect(note!.text).toContain('Vial Cap');
    // The note follows the <docsi-video> element in document order.
    expect(figure!.outerHTML.indexOf('<p class="docsi-note"')).toBeGreaterThan(figure!.outerHTML.indexOf('<docsi-video'));
  });

  it('docsi-text: <h1> equals the step title', () => {
    const doc = parse(html);
    const h1 = doc.querySelector('.docsi-text h1');
    expect(h1?.text.trim()).toBe('Fit the vial cap');
  });

  it('docsi-text: rendered Markdown body appears (h2, ordered list, bold text)', () => {
    const doc = parse(html);
    const body = doc.querySelector('.docsi-text .docsi-body');
    expect(body).toBeTruthy();
    expect(body!.querySelector('h2')?.text.trim()).toBe('Seating the electrodes');
    const items = body!.querySelectorAll('ol li');
    expect(items.length).toBe(3);
    expect(body!.innerHTML).toMatch(/<strong>vial cap<\/strong>/);
  });

  it('docsi-text: section.docsi-parts lists each part as a data-tagged <li> with the component name', () => {
    const doc = parse(html);
    const section = doc.querySelector('.docsi-text section.docsi-parts');
    expect(section).toBeTruthy();
    const items = section!.querySelectorAll('li');
    const byComponent = new Map(items.map((li) => [li.getAttribute('data-component'), li]));

    const vialCap = byComponent.get('vial-cap');
    expect(vialCap?.getAttribute('data-qty')).toBe('1');
    expect(vialCap?.getAttribute('data-cat')).toBe('printed');
    expect(vialCap?.text).toContain('Vial Cap');

    const topStop = byComponent.get('top-stop');
    expect(topStop?.getAttribute('data-qty')).toBe('2');
    expect(topStop?.getAttribute('data-cat')).toBe('printed');
    expect(topStop?.text).toContain('Top Stop');

    const anode = byComponent.get('anode');
    expect(anode?.getAttribute('data-qty')).toBe('1');
    expect(anode?.getAttribute('data-cat')).toBe('consumable');
    expect(anode?.text).toContain('MMO anode');
  });

  it('docsi-text: a tools list includes Blank Cap, positioned after docsi-parts and before docsi-safety', () => {
    const doc = parse(html);
    const textPane = doc.querySelector('.docsi-text')!;
    const toolItem = textPane.querySelector('li[data-component="blank-cap"]');
    expect(toolItem).toBeTruthy();
    expect(toolItem!.getAttribute('data-qty')).toBe('1');
    expect(toolItem!.text).toContain('Blank Cap');

    const wrapHtml = textPane.outerHTML;
    const partsIdx = wrapHtml.indexOf('class="docsi-parts"');
    const toolIdx = wrapHtml.indexOf('data-component="blank-cap"');
    const safetyIdx = wrapHtml.indexOf('class="docsi-safety"');
    expect(partsIdx).toBeGreaterThanOrEqual(0);
    expect(toolIdx).toBeGreaterThan(partsIdx);
    expect(safetyIdx).toBeGreaterThan(toolIdx);
  });

  it('docsi-text: <aside class="docsi-safety"> contains the safety text', () => {
    const doc = parse(html);
    const aside = doc.querySelector('.docsi-text aside.docsi-safety');
    expect(aside?.text).toContain('Wear eye protection when seating the cap; the glass vial can shatter.');
  });

  it('copied files exist at dist/_docsandeye/render/… and dist/_docsandeye/media/…', () => {
    const renderDir = path.join(DIST, '_docsandeye/render');
    const mediaDir = path.join(DIST, '_docsandeye/media');
    expect(fs.existsSync(path.join(renderDir, 'vial-cap@2.0.0--cap-iso--0fd0f88538ea.png'))).toBe(true);
    expect(fs.existsSync(path.join(renderDir, 'vial-cap@2.0.0--viewer--d2ced720dce2.glb'))).toBe(true);
    expect(fs.existsSync(path.join(mediaDir, 'photo-01-raft.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(mediaDir, 'photo-02-cap.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(mediaDir, 'vid-02-seat.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(mediaDir, 'vid-02-seat.mp4'))).toBe(true);
  });
});

describe('AC6: FRESH media is plain, with no details and no note', () => {
  it('AEP/step-01-raft: photo-01-raft <img> is in normal flow, no details, no docsi-note', () => {
    const doc = readHtml(DIST, 'AEP/step-01-raft/index.html');
    const figure = doc.querySelector('figure[data-media="photo-01-raft"]');
    expect(figure).toBeTruthy();
    expect(figure!.getAttribute('data-status')).toBe('FRESH');
    expect(figure!.parentNode?.tagName).not.toBe('DETAILS');
    expect(figure!.querySelector('p.docsi-note')).toBeFalsy();
    expect(doc.querySelector('details.docsi-stale')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// AC5 (build portion): exactly one module registering script per step page,
// under 30KB (v0.2: docsi-video joins the other three), containing all four
// customElements.define(...), plus a separate chunk containing "model-viewer".
// ---------------------------------------------------------------------------

describe('AC5: custom elements upgrade, not replace', () => {
  const stepPages = ['AEP/step-01-raft/index.html', 'AEP/step-02-cap/index.html', 'MEP/step-03-mep-only/index.html'];

  /** Of a page's `<script type="module" src="…">` tags, the one whose file registers all four custom elements — "the registering script" (AC1 in v0.2's spec). Other module scripts (e.g. Astro/Starlight's own runtime) are not this package's concern. */
  function findRegisteringScript(doc: ReturnType<typeof readHtml>): { src: string; filePath: string; content: string } {
    const candidates = doc.querySelectorAll('script[type="module"]').filter((s) => !!s.getAttribute('src'));
    const registering = candidates
      .map((s) => {
        const src = s.getAttribute('src')!;
        const filePath = path.join(DIST, src.replace(/^\//, ''));
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
        const normalised = content.replace(/'/g, '"');
        return { src, filePath, content, normalised };
      })
      .filter(
        (c) =>
          c.normalised.includes('customElements.define("docsi-step"') &&
          c.normalised.includes('customElements.define("docsi-model"') &&
          c.normalised.includes('customElements.define("docsi-lightbox"') &&
          c.normalised.includes('customElements.define("docsi-video"'),
      );
    expect(registering.length, 'expected exactly one module script registering all four custom elements').toBe(1);
    return registering[0]!;
  }

  for (const page of stepPages) {
    it(`${page}: exactly one <script type="module" src="…"> registers all four custom elements (incl. docsi-video), under 30KB`, () => {
      const doc = readHtml(DIST, page);
      const { filePath } = findRegisteringScript(doc);
      const size = fs.statSync(filePath).size;
      expect(size).toBeLessThan(30 * 1024);
    });
  }

  it('dist/ contains a separate chunk (not the registering script) whose content includes "model-viewer"', () => {
    const doc = readHtml(DIST, 'AEP/step-02-cap/index.html');
    const { src: registeringSrc } = findRegisteringScript(doc);

    const jsFiles = walk(DIST).filter((f) => f.endsWith('.js'));
    const modelViewerChunks = jsFiles.filter((f) => {
      if (`/${f}` === registeringSrc) return false;
      return fs.readFileSync(path.join(DIST, f), 'utf8').includes('model-viewer');
    });
    expect(modelViewerChunks.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC7: Sidebar badges
// ---------------------------------------------------------------------------

describe('AC7 sidebar badges', () => {
  it('step-02-cap carries both stale-media and updated badges', () => {
    const doc = readHtml(DIST, 'AEP/index.html');
    const li = doc.querySelector('li[data-step="step-02-cap"]');
    expect(li).toBeTruthy();
    const stale = li!.querySelector('.docsi-badge-stale');
    const updated = li!.querySelector('.docsi-badge-updated');
    expect(stale?.text.trim()).toBe('stale media');
    expect(updated?.text.trim()).toBe('updated');
  });

  it('step-01-raft carries neither badge', () => {
    const doc = readHtml(DIST, 'AEP/index.html');
    const li = doc.querySelector('li[data-step="step-01-raft"]');
    expect(li).toBeTruthy();
    expect(li!.querySelector('.docsi-badge-stale')).toBeFalsy();
    expect(li!.querySelector('.docsi-badge-updated')).toBeFalsy();
  });

  it('sidebar lists the guide steps in order (step-01-raft before step-02-cap)', () => {
    const doc = readHtml(DIST, 'AEP/index.html');
    const items = doc.querySelectorAll('.docsi-steps li');
    const order = items.map((li) => li.getAttribute('data-step'));
    expect(order.indexOf('step-01-raft')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('step-02-cap')).toBeGreaterThan(order.indexOf('step-01-raft'));
  });
});

// ---------------------------------------------------------------------------
// AC8: Reshoot dashboard (maintainer build)
// ---------------------------------------------------------------------------

describe('AC8 reshoot dashboard', () => {
  it('table rows: top-stop now precedes vial-cap (v0.2: vid-03-old gives top-stop a stale hero too, tying it with vial-cap on staleHeroCount=1; ties break by component id ascending, "top-stop" < "vial-cap"); anode is also present', () => {
    const doc = readHtml(DIST_MAINTAINER, 'reshoot/index.html');
    const rows = doc.querySelectorAll('table.docsi-reshoot tbody tr');
    expect(rows.length).toBe(3);

    const first = rows[0]!;
    expect(first.getAttribute('data-component')).toBe('top-stop');
    expect(first.classList.contains('docsi-stale')).toBe(true);
    expect(first.text).toContain('Top Stop');
    expect(first.querySelector('code')?.text.trim()).toBe('top-stop');
    expect(first.querySelectorAll('td')[1]?.text).toContain('1.3.0');

    const second = rows[1]!;
    expect(second.getAttribute('data-component')).toBe('vial-cap');
    expect(second.classList.contains('docsi-stale')).toBe(true);
    expect(second.text).toContain('Vial Cap');
    expect(second.querySelector('code')?.text.trim()).toBe('vial-cap');

    const byComponent = new Map(rows.map((r) => [r.getAttribute('data-component'), r]));
    expect(byComponent.has('top-stop')).toBe(true);
    expect(byComponent.has('vial-cap')).toBe(true);
    expect(byComponent.has('anode')).toBe(true);

    const anode = byComponent.get('anode')!;
    expect(anode.text).toContain('MMO anode');
    expect(anode.querySelectorAll('td')[1]?.text).toContain('1.0.0');
  });

  it('each row lists per-appearance media id, role and status', () => {
    const doc = readHtml(DIST_MAINTAINER, 'reshoot/index.html');
    const vialCapRow = doc.querySelector('tr[data-component="vial-cap"]');
    const appearances = vialCapRow!.querySelectorAll('li');
    const byMedia = new Map(appearances.map((li) => [li.getAttribute('data-media'), li]));

    const photo = byMedia.get('photo-02-cap');
    expect(photo?.getAttribute('data-role')).toBe('hero');
    expect(photo?.getAttribute('data-status')).toBe('STALE');

    const video = byMedia.get('vid-02-seat');
    expect(video?.getAttribute('data-role')).toBe('in_frame');
    expect(video?.getAttribute('data-status')).toBe('CHANGED_IN_FRAME');
  });
});

// ---------------------------------------------------------------------------
// AC9: Page metadata for the CLI + carbon figure
// ---------------------------------------------------------------------------

describe('AC9 page metadata and carbon figure', () => {
  const stepPages: Array<{ path: string; step: string; guide: string }> = [
    { path: 'AEP/step-01-raft/index.html', step: 'step-01-raft', guide: 'aep' },
    { path: 'AEP/step-02-cap/index.html', step: 'step-02-cap', guide: 'aep' },
    { path: 'MEP/step-01-raft/index.html', step: 'step-01-raft', guide: 'mep' },
    { path: 'MEP/step-03-mep-only/index.html', step: 'step-03-mep-only', guide: 'mep' },
  ];

  for (const { path: rel, step, guide } of stepPages) {
    it(`${rel}: <head> has docsandeye:step=${step} and docsandeye:guide=${guide}`, () => {
      const doc = readHtml(DIST, rel);
      const stepMeta = doc.querySelector('head meta[name="docsandeye:step"]');
      const guideMeta = doc.querySelector('head meta[name="docsandeye:guide"]');
      expect(stepMeta?.getAttribute('content')).toBe(step);
      expect(guideMeta?.getAttribute('content')).toBe(guide);
    });
  }

  it('AEP/step-02-cap/index.html renders the exact carbon figure', () => {
    const doc = readHtml(DIST, 'AEP/step-02-cap/index.html');
    const carbon = doc.querySelector('.docsi-carbon');
    expect(carbon?.text.trim()).toBe('≈ 0.01 g CO₂e per view');
  });

  it('AEP/step-01-raft/index.html has no docsi-carbon span', () => {
    const doc = readHtml(DIST, 'AEP/step-01-raft/index.html');
    expect(doc.querySelector('.docsi-carbon')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// AC10: Guide index
// ---------------------------------------------------------------------------

describe('AC10 guide index', () => {
  it('AEP/index.html lists the aep steps as links in order, with titles and parts counts', () => {
    const doc = readHtml(DIST, 'AEP/index.html');
    const items = doc.querySelectorAll('ol.docsi-guide-steps li');
    expect(items.length).toBe(2);

    const first = items[0]!;
    expect(first.getAttribute('data-step')).toBe('step-01-raft');
    expect(first.querySelector('a')?.text.trim()).toBe('Print the raft');
    expect(first.querySelector('.docsi-parts-count')?.text.trim()).toBe('2 parts');

    const second = items[1]!;
    expect(second.getAttribute('data-step')).toBe('step-02-cap');
    expect(second.querySelector('a')?.text.trim()).toBe('Fit the vial cap');
    expect(second.querySelector('.docsi-parts-count')?.text.trim()).toBe('3 parts');
  });

  it('AEP/index.html has no link to /reshoot/ in the default (non-maintainer) build', () => {
    const doc = readHtml(DIST, 'AEP/index.html');
    const links = doc.querySelectorAll('a').map((a) => a.getAttribute('href'));
    expect(links).not.toContain('/reshoot/');
  });

  it('AEP/index.html links to /reshoot/ only in the maintainer build', () => {
    const doc = readHtml(DIST_MAINTAINER, 'AEP/index.html');
    const links = doc.querySelectorAll('a').map((a) => a.getAttribute('href'));
    expect(links).toContain('/reshoot/');
  });
});

// ---------------------------------------------------------------------------
// AC11 (first-paint script portion): the plugin puts the themes head script in
// <head> for a theme pack, exactly once, and leaves a stock-pack site alone.
// ---------------------------------------------------------------------------

describe('AC11 theme wiring: first-paint script in <head>', () => {
  const MARKER = 'data-docsi-theme';

  function countMarker(distDir: string, relPath: string): number {
    return rawHtml(distDir, relPath).split(MARKER).length - 1;
  }

  it('a theme-pack site gets the script even though its config never adds one', () => {
    const html = rawHtml(DIST_PIOREACTOR, 'AEP/step-01-raft/index.html');
    expect(html).toContain(MARKER);
    // The script itself: it restores the stored pack before first paint.
    expect(html).toContain('docsiPack');
    expect(countMarker(DIST_PIOREACTOR, 'AEP/step-01-raft/index.html')).toBe(1);
    expect(countMarker(DIST_PIOREACTOR, 'AEP/index.html')).toBe(1);
  });

  it('a theme-pack site that adds the script itself gets exactly one copy', () => {
    expect(countMarker(DIST_PIOREACTOR_MANUAL_HEAD, 'AEP/step-01-raft/index.html')).toBe(1);
    expect(countMarker(DIST_PIOREACTOR_MANUAL_HEAD, 'AEP/index.html')).toBe(1);
  });

  it('the stock starlight pack gets no first-paint script', () => {
    expect(rawHtml(DIST, 'AEP/step-01-raft/index.html')).not.toContain(MARKER);
  });
});

// ---------------------------------------------------------------------------
// AC11 (built-CSS portion): the token contract in the built CSS
// ---------------------------------------------------------------------------

describe('AC11 theme wiring: built CSS token contract', () => {
  it('dist/ CSS contains --docsi-media-col:55% (whitespace-insensitive) and a dark-theme block', () => {
    const cssFiles = walk(DIST).filter((f) => f.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);

    const allCss = cssFiles.map((f) => fs.readFileSync(path.join(DIST, f), 'utf8')).join('\n');
    const collapsed = allCss.replace(/\s+/g, '');
    expect(collapsed).toContain('--docsi-media-col:55%');

    const hasDarkThemeBlock = /:root\[data-theme=(?:dark|'dark'|"dark")\]/.test(allCss);
    expect(hasDarkThemeBlock).toBe(true);
  });
});
