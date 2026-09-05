/**
 * Tester suite — task_008 (v0.2 video in the plugin) acceptance criteria.
 *
 * Builds `fixtures/site`, `fixtures/site-hosted` and `fixtures/site-nomanifest`
 * once each (AC1-5, 7, 9-11 need real `dist/` output; AC6 is pure and needs
 * no build).
 *
 * `fixtures/site` is ALSO built by build.test.ts's own beforeAll (same
 * fixture, same DOCSANDEYE_BUILD_DATE). Running two `astro build`s against
 * the very same fixture directory concurrently races Vite's
 * `node_modules/.vite` dependency cache and the build's own dist-assembly
 * rename step (both proven empirically: an ENOTEMPTY rename on
 * `deps_temp_*` -> `deps`, and an ENOENT rename moving `.prerender/` assets
 * into `dist/`) — and build.test.ts's own build has no retry, so a losing
 * race there would fail its whole suite, which this file must never cause.
 * Rather than build into `fixtures/site` a second time, this file builds an
 * ephemeral sibling copy (`fixtures/site-tester-scratch`, same depth under
 * `fixtures/` so the fixture's relative imports — `../../index.ts`,
 * `../project` — resolve unchanged) with its own independent
 * `node_modules/.vite` cache, so no build here ever touches a directory
 * build.test.ts also writes to. Removed again in `afterAll`.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse } from 'node-html-parser';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bannerText, pickRendition } from '../src/elements/docsi-video.ts';

const execFileP = promisify(execFile);
const BUILD_TIMEOUT = 600_000;

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(PKG_ROOT, '../..');
const FIXTURES_DIR = path.join(PKG_ROOT, 'fixtures');
const SITE_SRC_DIR = path.join(FIXTURES_DIR, 'site');
const SITE_SCRATCH_DIR = path.join(FIXTURES_DIR, 'site-tester-scratch'); // ephemeral; never committed
const HOSTED_DIR = path.join(FIXTURES_DIR, 'site-hosted');
const NOMANIFEST_DIR = path.join(FIXTURES_DIR, 'site-nomanifest');
const DIST = path.join(SITE_SCRATCH_DIR, 'dist'); // this file's own isolated build, not build.test.ts's
const HOSTED_DIST = path.join(HOSTED_DIR, 'dist');
const NOMANIFEST_DIST = path.join(NOMANIFEST_DIR, 'dist');

/** Copy `src` to `dest`, skipping build/dependency/cache directories that must be regenerated fresh. */
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

async function buildOnce(dir: string, extraArgs: string[] = []): Promise<void> {
  await execFileP('npx', ['astro', 'build', ...extraArgs], {
    cwd: dir,
    env: { ...process.env, DOCSANDEYE_BUILD_DATE: '2026-09-04' },
    timeout: BUILD_TIMEOUT,
    maxBuffer: 1024 * 1024 * 64,
  });
}

/** Cheap insurance against unrelated transient failures (machine load); not relied on for the fixtures/site race, which the scratch copy avoids structurally. */
async function buildWithRetry(dir: string, extraArgs: string[] = [], attempts = 3): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await buildOnce(dir, extraArgs);
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 3000 + i * 2000));
    }
  }
  throw lastErr;
}

let siteBuildOk = false;
let hostedBuildOk = false;
let nomanifestBuildOk = false;

beforeAll(async () => {
  fs.rmSync(SITE_SCRATCH_DIR, { recursive: true, force: true });
  copyFixtureTree(SITE_SRC_DIR, SITE_SCRATCH_DIR);
  await buildWithRetry(SITE_SCRATCH_DIR);
  siteBuildOk = true;
  await buildWithRetry(HOSTED_DIR);
  hostedBuildOk = true;
  await buildWithRetry(NOMANIFEST_DIR);
  nomanifestBuildOk = true;
}, BUILD_TIMEOUT * 2);

afterAll(() => {
  fs.rmSync(SITE_SCRATCH_DIR, { recursive: true, force: true });
});

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
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

describe('builds succeed', () => {
  it('fixtures/site, fixtures/site-hosted and fixtures/site-nomanifest all built', () => {
    expect(siteBuildOk).toBe(true);
    expect(hostedBuildOk).toBe(true);
    expect(nomanifestBuildOk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC1: Element registration
// ---------------------------------------------------------------------------

describe('AC1: element registration', () => {
  it('the registering script defines docsi-step, docsi-model, docsi-lightbox and docsi-video, under 30KB (full per-page coverage in build.test.ts)', () => {
    const doc = readHtml(DIST, 'AEP/step-02-cap/index.html');
    const scripts = doc.querySelectorAll('script[type="module"]').filter((s) => !!s.getAttribute('src'));
    const registering = scripts
      .map((s) => {
        const src = s.getAttribute('src')!;
        const filePath = path.join(DIST, src.replace(/^\//, ''));
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
        return { filePath, normalised: content.replace(/'/g, '"') };
      })
      .filter((c) =>
        ['docsi-step', 'docsi-model', 'docsi-lightbox', 'docsi-video'].every((name) =>
          c.normalised.includes(`customElements.define("${name}"`),
        ),
      );
    expect(registering.length, 'expected exactly one module script registering all four custom elements').toBe(1);
    expect(fs.statSync(registering[0]!.filePath).size).toBeLessThan(30 * 1024);
  });

  it('src/elements/docsi-video.ts has no static import — no video library dependency', () => {
    const source = fs.readFileSync(path.join(PKG_ROOT, 'src/elements/docsi-video.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\b/m);
  });
});

// ---------------------------------------------------------------------------
// AC2: Facade markup — encoded contract, CHANGED_IN_FRAME vid-02-seat
// ---------------------------------------------------------------------------

describe('AC2: encoded facade markup for CHANGED_IN_FRAME vid-02-seat', () => {
  let html: string;

  beforeAll(() => {
    html = rawHtml(DIST, 'AEP/step-02-cap/index.html');
  });

  it('the <docsi-video> element carries data-media/data-status/data-renditions and the persistent (initially hidden) banner', () => {
    const doc = parse(html);
    const video = doc.querySelector('docsi-video[data-media="vid-02-seat"]');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('data-status')).toBe('CHANGED_IN_FRAME');
    expect(video!.getAttribute('data-renditions')).toBe('720,1080');

    const banner = video!.querySelector('p.docsi-banner');
    expect(banner).toBeTruthy();
    expect(banner!.hasAttribute('hidden')).toBe(true);
    expect(banner!.text.trim()).toBe('Recorded with Vial Cap v1.0.0, current is v2.0.0');
  });

  it('the facade <video>: preload="none", poster ending vid-02-seat.webp, controls, playsinline', () => {
    const doc = parse(html);
    const videoEl = doc.querySelector('docsi-video[data-media="vid-02-seat"] video')!;
    expect(videoEl.getAttribute('preload')).toBe('none');
    expect(videoEl.getAttribute('poster')).toBe('/_docsandeye/media/vid-02-seat.webp');
    expect(videoEl.hasAttribute('controls')).toBe(true);
    expect(videoEl.hasAttribute('playsinline')).toBe(true);
  });

  it('AV1 <source> precedes H.264, both data-height="720" (the lowest offered rendition)', () => {
    const doc = parse(html);
    const sources = doc.querySelectorAll('docsi-video[data-media="vid-02-seat"] video source');
    expect(sources.length).toBe(2);
    expect(sources[0]!.getAttribute('type')).toBe('video/webm; codecs=av01.0.05M.08');
    expect(sources[0]!.getAttribute('data-height')).toBe('720');
    expect(sources[0]!.getAttribute('src')).toBe('/_docsandeye/media/vid-02-seat-720.webm');
    expect(sources[1]!.getAttribute('type')).toBe('video/mp4');
    expect(sources[1]!.getAttribute('data-height')).toBe('720');
    expect(sources[1]!.getAttribute('src')).toBe('/_docsandeye/media/vid-02-seat-720.mp4');
  });

  it('<track kind="captions"> is present (the fixture manifest gives vid-02-seat captions)', () => {
    const doc = parse(html);
    const track = doc.querySelector('docsi-video[data-media="vid-02-seat"] video track');
    expect(track).toBeTruthy();
    expect(track!.getAttribute('kind')).toBe('captions');
    expect(track!.getAttribute('srclang')).toBe('en');
    expect(track!.getAttribute('src')).toBe('/_docsandeye/media/vid-02-seat.en.vtt');
    expect(track!.hasAttribute('default')).toBe(true);
  });

  it('<noscript> download link points at the 720p mp4', () => {
    const doc = parse(html);
    const video = doc.querySelector('docsi-video[data-media="vid-02-seat"]')!;
    // node-html-parser treats <noscript> content as opaque text, not a
    // sub-tree, so its markup is asserted via innerHTML rather than querySelector.
    const noscript = video.querySelector('noscript');
    expect(noscript).toBeTruthy();
    expect(noscript!.innerHTML).toContain('href="/_docsandeye/media/vid-02-seat-720.mp4"');
    expect(noscript!.innerHTML).toContain('Download the video');
  });

  it('the pre-existing <p class="docsi-note"> remains, mentioning Vial Cap', () => {
    const doc = parse(html);
    const figure = doc.querySelector('docsi-video[data-media="vid-02-seat"]')!.closest('figure.docsi-video-figure')!;
    const note = figure.querySelector('p.docsi-note');
    expect(note).toBeTruthy();
    expect(note!.text.trim()).toBe('Vial Cap also appears in this video and has changed since it was filmed (v1.0.0 → v2.0.0).');
  });
});

// ---------------------------------------------------------------------------
// AC3: STALE flow — vid-03-old (hero top-stop@1.0.0, current 1.3.0)
// ---------------------------------------------------------------------------

describe('AC3: STALE video flow for vid-03-old', () => {
  let html: string;

  beforeAll(() => {
    html = rawHtml(DIST, 'AEP/step-02-cap/index.html');
  });

  it('a single <details class="docsi-stale docsi-stale-video"> with the exact summary text', () => {
    const doc = parse(html);
    const detailsList = doc.querySelectorAll('details.docsi-stale-video');
    expect(detailsList.length).toBe(1);
    const details = detailsList[0]!;
    expect(details.classList.contains('docsi-stale')).toBe(true);
    const summary = details.querySelector('summary');
    expect(summary!.text.trim()).toBe('A video exists for this step, but Top Stop has changed since it was filmed (v1.0.0 → v1.3.0)');
  });

  it('exactly one changelog <li> (the 1.3.0 chamfer entry, the only one in (1.0.0, 1.3.0])', () => {
    const doc = parse(html);
    const details = doc.querySelector('details.docsi-stale-video')!;
    const items = details.querySelectorAll('ul.docsi-changelog li');
    expect(items.length).toBe(1);
    expect(items[0]!.text).toContain('1.3.0');
    expect(items[0]!.text).toContain('Chamfer on electrode bore.');
  });

  it('the "Watch the older video" button and the hidden .docsi-older box containing the <docsi-video> (STALE, one rendition)', () => {
    const doc = parse(html);
    const details = doc.querySelector('details.docsi-stale-video')!;

    const button = details.querySelector('button.docsi-watch-older');
    expect(button).toBeTruthy();
    expect(button!.getAttribute('type')).toBe('button');
    expect(button!.text.trim()).toBe('Watch the older video');

    const older = details.querySelector('div.docsi-older');
    expect(older).toBeTruthy();
    expect(older!.hasAttribute('hidden')).toBe(true);

    const video = older!.querySelector('docsi-video[data-media="vid-03-old"]');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('data-status')).toBe('STALE');
    // vid-03-old's manifest job only offers 720 (1080 is in skipped_renditions).
    expect(video!.getAttribute('data-renditions')).toBe('720');

    const banner = video!.querySelector('p.docsi-banner');
    expect(banner).toBeTruthy();
    expect(banner!.hasAttribute('hidden')).toBe(true);
    expect(banner!.text.trim()).toBe('Recorded with Top Stop v1.0.0, current is v1.3.0');

    const videoEl = video!.querySelector('video')!;
    expect(videoEl.getAttribute('preload')).toBe('none');
    const sources = videoEl.querySelectorAll('source');
    expect(sources.length).toBe(2);
    expect(sources[0]!.getAttribute('src')).toBe('/_docsandeye/media/vid-03-old-720.webm');
    expect(sources[1]!.getAttribute('src')).toBe('/_docsandeye/media/vid-03-old-720.mp4');
    // vid-03-old's manifest job has no captions output.
    expect(videoEl.querySelector('track')).toBeFalsy();
  });

  it('the <noscript> link sits after the .docsi-older div, outside it, and still points at the video', () => {
    const doc = parse(html);
    const details = doc.querySelector('details.docsi-stale-video')!;
    const older = details.querySelector('div.docsi-older')!;

    // Opaque noscript content (see AC2's note): assert via innerHTML.
    expect(older.querySelector('noscript')).toBeFalsy();
    expect(older.innerHTML).not.toContain('<noscript>');

    const detailsHtml = details.outerHTML;
    const olderCloseIdx = detailsHtml.lastIndexOf('</div>');
    const noscriptIdx = detailsHtml.indexOf('<noscript>');
    expect(noscriptIdx).toBeGreaterThan(0);
    expect(noscriptIdx).toBeGreaterThan(olderCloseIdx);

    const noscript = details.querySelector('noscript');
    expect(noscript!.innerHTML).toContain('href="/_docsandeye/media/vid-03-old-720.mp4"');
  });

  it('document order: the render, viewer and in-flow vid-02-seat precede the vid-03-old STALE details', () => {
    const renderIdx = html.indexOf('data-render="cap-iso"');
    const modelIdx = html.indexOf('<docsi-model');
    const videoIdx = html.indexOf('data-media="vid-02-seat"');
    const staleVideoIdx = html.indexOf('docsi-stale-video');
    expect(renderIdx).toBeGreaterThanOrEqual(0);
    expect(modelIdx).toBeGreaterThan(renderIdx);
    expect(videoIdx).toBeGreaterThan(modelIdx);
    expect(staleVideoIdx).toBeGreaterThan(videoIdx);
  });
});

// ---------------------------------------------------------------------------
// AC4: FRESH — vid-01-raft
// ---------------------------------------------------------------------------

describe('AC4: FRESH vid-01-raft on step-01-raft', () => {
  it('renders <docsi-video data-status="FRESH"> in normal flow, no banner element, no STALE details on this step', () => {
    const doc = readHtml(DIST, 'AEP/step-01-raft/index.html');
    const video = doc.querySelector('docsi-video[data-media="vid-01-raft"]');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('data-status')).toBe('FRESH');
    expect(video!.closest('details')).toBeFalsy();
    expect(video!.querySelector('.docsi-banner')).toBeFalsy();
    expect(doc.querySelector('details.docsi-stale')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// AC5: Copy step and hosting
// ---------------------------------------------------------------------------

describe('AC5: copy step and hosting', () => {
  it('every output path in the fixture build/media/manifest.json appears under dist/_docsandeye/media/ (local hosting)', () => {
    const manifestPath = path.join(PKG_ROOT, 'fixtures/project/build/media/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { jobs: Record<string, { outputs: Record<string, string> }> };
    const mediaDir = path.join(DIST, '_docsandeye/media');
    const basenames = new Set<string>();
    for (const job of Object.values(manifest.jobs)) {
      for (const rel of Object.values(job.outputs)) basenames.add(path.basename(rel));
    }
    expect(basenames.size).toBeGreaterThan(0);
    for (const base of basenames) {
      expect(fs.existsSync(path.join(mediaDir, base)), `expected dist/_docsandeye/media/${base} to exist`).toBe(true);
    }
  });

  it('fixtures/site-hosted: src/poster/track resolve via the hosting provider (https://media.example/build/media/…)', () => {
    const html = rawHtml(HOSTED_DIST, 'AEP/step-02-cap/index.html');
    const doc = parse(html);
    const videoEl = doc.querySelector('docsi-video[data-media="vid-02-seat"] video')!;
    expect(videoEl.getAttribute('poster')).toBe('https://media.example/build/media/vid-02-seat.webp');
    const sources = videoEl.querySelectorAll('source');
    expect(sources[0]!.getAttribute('src')).toBe('https://media.example/build/media/vid-02-seat-720.webm');
    expect(sources[1]!.getAttribute('src')).toBe('https://media.example/build/media/vid-02-seat-720.mp4');
    const track = videoEl.querySelector('track');
    expect(track!.getAttribute('src')).toBe('https://media.example/build/media/vid-02-seat.en.vtt');
  });

  it('fixtures/site-hosted: dist/ contains no .webm/.mp4/.vtt files (the copy step skips media outputs for a hosting provider)', () => {
    const files = walk(HOSTED_DIST);
    const mediaFiles = files.filter((f) => /\.(webm|mp4|vtt)$/.test(f));
    expect(mediaFiles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC6: Client helpers — pickRendition / bannerText (pure, no build)
// ---------------------------------------------------------------------------

describe('AC6: pickRendition and bannerText', () => {
  it('saveData forces the lowest available rendition', () => {
    expect(pickRendition({ saveData: true, dpr: 3, width: 2000, available: [720, 1080] })).toBe(720);
  });

  it('effectiveType "3g" forces the lowest available rendition', () => {
    expect(pickRendition({ effectiveType: '3g', dpr: 3, width: 2000, available: [720, 1080] })).toBe(720);
  });

  it('prefers-reduced-data forces the lowest available rendition', () => {
    expect(pickRendition({ reducedData: true, dpr: 3, width: 2000, available: [720, 1080] })).toBe(720);
  });

  it('dpr 2 x width 700 (physical 1400 >= 1280) with [720, 1080] available picks 1080', () => {
    expect(pickRendition({ dpr: 2, width: 700, available: [720, 1080] })).toBe(1080);
  });

  it('dpr 1 x width 1000 (physical 1000 < 1280) picks 720', () => {
    expect(pickRendition({ dpr: 1, width: 1000, available: [720, 1080] })).toBe(720);
  });

  it('[720] only (1080 not offered) picks 720 even on a large viewport', () => {
    expect(pickRendition({ dpr: 3, width: 2000, available: [720] })).toBe(720);
  });

  it('bannerText: STALE names the first stale hero', () => {
    const text = bannerText('STALE', {
      stale_heroes: [{ name: 'Top Stop', shot_with: '1.0.0', current: '1.3.0' }],
      changed_in_frame: [],
    });
    expect(text).toBe('Recorded with Top Stop v1.0.0, current is v1.3.0');
  });

  it('bannerText: CHANGED_IN_FRAME names the first changed in-frame component', () => {
    const text = bannerText('CHANGED_IN_FRAME', {
      stale_heroes: [],
      changed_in_frame: [{ name: 'Vial Cap', shot_with: '1.0.0', current: '2.0.0' }],
    });
    expect(text).toBe('Recorded with Vial Cap v1.0.0, current is v2.0.0');
  });

  it('bannerText: FRESH returns null', () => {
    const text = bannerText('FRESH', { stale_heroes: [], changed_in_frame: [] });
    expect(text).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC7: No bytes before play
// ---------------------------------------------------------------------------

describe('AC7: no video bytes move before play', () => {
  it('no step page contains preload="auto"|"metadata", autoplay, or <link rel="preload" as="video">', () => {
    const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
    expect(htmlFiles.length).toBeGreaterThan(0);
    for (const rel of htmlFiles) {
      const content = fs.readFileSync(path.join(DIST, rel), 'utf8');
      expect(content, `${rel}: preload="auto"`).not.toMatch(/preload=["']auto["']/);
      expect(content, `${rel}: preload="metadata"`).not.toMatch(/preload=["']metadata["']/);
      expect(content, `${rel}: autoplay`).not.toMatch(/\bautoplay\b/);
      expect(content, `${rel}: <link rel=preload as=video>`).not.toMatch(/<link[^>]*rel=["']preload["'][^>]*as=["']video["']/);
    }
  });

  it('positive control: preload="none" does appear on the step page with video', () => {
    const content = rawHtml(DIST, 'AEP/step-02-cap/index.html');
    expect(content).toContain('preload="none"');
  });
});

// ---------------------------------------------------------------------------
// AC9: Degraded mode (no build/media/manifest.json)
// ---------------------------------------------------------------------------

describe('AC9: degraded mode (fixtures/project-nomanifest)', () => {
  it('vid-02-seat renders the degraded contract: data-renditions="source", one authored <source>, authored poster, no <track>, banner still present', () => {
    const html = rawHtml(NOMANIFEST_DIST, 'AEP/step-02-cap/index.html');
    const doc = parse(html);
    const video = doc.querySelector('docsi-video[data-media="vid-02-seat"]');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('data-status')).toBe('CHANGED_IN_FRAME');
    expect(video!.getAttribute('data-renditions')).toBe('source');

    const banner = video!.querySelector('p.docsi-banner');
    expect(banner).toBeTruthy();
    expect(banner!.hasAttribute('hidden')).toBe(true);
    expect(banner!.text.trim()).toBe('Recorded with Vial Cap v1.0.0, current is v2.0.0');

    const videoEl = video!.querySelector('video')!;
    expect(videoEl.getAttribute('preload')).toBe('none');
    expect(videoEl.getAttribute('poster')).toBe('/_docsandeye/media/vid-02-seat.jpg');
    const sources = videoEl.querySelectorAll('source');
    expect(sources.length).toBe(1);
    expect(sources[0]!.getAttribute('src')).toBe('/_docsandeye/media/vid-02-seat.mp4');
    expect(sources[0]!.getAttribute('type')).toBe('video/mp4');
    expect(videoEl.querySelector('track')).toBeFalsy();

    const noscript = video!.querySelector('noscript');
    expect(noscript).toBeTruthy();
    expect(noscript!.innerHTML).toContain('href="/_docsandeye/media/vid-02-seat.mp4"');
  });

  it('no data-docsi-video attribute anywhere in dist/ (the v0.1 placeholder is fully retired)', () => {
    for (const dist of [DIST, HOSTED_DIST, NOMANIFEST_DIST]) {
      const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
      for (const rel of htmlFiles) {
        const content = fs.readFileSync(path.join(dist, rel), 'utf8');
        expect(content, `${dist}/${rel}`).not.toContain('data-docsi-video');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AC10: Tokens and styles
// ---------------------------------------------------------------------------

describe('AC10: banner tokens and sticky positioning', () => {
  it('dist/ CSS defines --docsi-banner-bg (accent-low) and --docsi-banner-fg (text) with sensible defaults', () => {
    const cssFiles = walk(DIST).filter((f) => f.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);
    const allCss = cssFiles.map((f) => fs.readFileSync(path.join(DIST, f), 'utf8')).join('\n');
    const collapsed = allCss.replace(/\s+/g, '');
    expect(collapsed).toContain('--docsi-banner-bg:var(--docsi-accent-low)');
    expect(collapsed).toContain('--docsi-banner-fg:var(--docsi-text)');
  });

  it('.docsi-banner is position:sticky; top:0 (inside the docsi-video box)', () => {
    const cssFiles = walk(DIST).filter((f) => f.endsWith('.css'));
    const allCss = cssFiles.map((f) => fs.readFileSync(path.join(DIST, f), 'utf8')).join('\n');
    const collapsed = allCss.replace(/\s+/g, '');
    // The minifier may reorder declarations within the rule (observed:
    // `position`/`top` moved to the end), so extract the whole
    // `.docsi-banner{...}` block and assert on its declarations rather than
    // a fixed property order.
    const match = /\.docsi-banner\{([^}]*)\}/.exec(collapsed);
    expect(match, 'expected a .docsi-banner{...} rule in the built CSS').toBeTruthy();
    expect(match![1]).toContain('position:sticky');
    expect(match![1]).toContain('top:0');
  });

  it('packages/themes/** carries no diff against main (not edited by this task)', async () => {
    const { stdout } = await execFileP('git', ['diff', '--name-only', 'main', '--', 'packages/themes'], { cwd: REPO_ROOT });
    expect(stdout.trim()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// AC11: Package hygiene
// ---------------------------------------------------------------------------

describe('AC11: package hygiene', () => {
  it('no new runtime dependency in starlight-docsandeye or cli package.json (matches the pre-task_008 dependency set)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['@astrojs/markdown-remark', '@docsandeye/core', '@google/model-viewer', 'zod']);

    const cliPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/cli/package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    expect(Object.keys(cliPkg.dependencies ?? {}).sort()).toEqual(['@docsandeye/core', '@tgwf/co2', 'node-html-parser', 'yaml']);
  });

  it(
    'root npm run build is green for the packages this task touches (core, cli, starlight-docsandeye)',
    async () => {
      await execFileP(
        'npm',
        ['run', 'build', '--workspace=packages/core', '--workspace=packages/cli', '--workspace=packages/starlight-docsandeye'],
        { cwd: REPO_ROOT, timeout: BUILD_TIMEOUT, maxBuffer: 1024 * 1024 * 64 },
      );
      // `npx vitest run` (the full suite, this file included) is exercised
      // directly by the Tester's own end-of-cycle verification run, not
      // re-asserted here to avoid a self-referential check.
    },
    BUILD_TIMEOUT,
  );
});
