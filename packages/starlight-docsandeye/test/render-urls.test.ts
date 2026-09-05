/**
 * Render URLs are percent-encoded, and a render whose output is not an image
 * is not put in an `<img>`.
 *
 * Two defects, one fixture:
 *
 * 1. `renderUrl` (and every other helper that turns a manifest output or a
 *    media path into a URL) used the basename verbatim. A derived file called
 *    `Odd Cap #1 v2.stl` produced `href="/_docsandeye/render/Odd Cap #1 v2.stl"`
 *    — the `#` starts a fragment, so the browser requested
 *    `/_docsandeye/render/Odd Cap ` and got a 404. Every segment is now
 *    `encodeURIComponent`d, `/` kept as the separator. The copy step is
 *    deliberately NOT encoded: the file keeps its on-disk name and the server
 *    (or the dev-server handler, which calls `decodeURIComponent`) decodes.
 *
 * 2. A hand-exported component's derived files are its render outputs, and
 *    `.stl`/`.step`/`.3mf` are not images. The page rendered `<img src="…stl">`,
 *    which is always a broken image. It now shows `<docsi-model>` when a
 *    `.glb`/`.gltf` exists to view and a download link otherwise.
 *
 * Independence note: expected values come from the fixture YAML/Markdown/JSON
 * and from `encodeURIComponent` applied by hand to the authored basenames,
 * never from running the plugin and reading back whatever it produced.
 *
 * Build isolation: `fixtures/site*` are built by several test files at once,
 * which races Vite's dependency cache and the dist-assembly rename (see
 * `video.test.ts`), so this file copies its own site fixture to an ephemeral
 * sibling under a name no other test file uses and builds that.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse } from 'node-html-parser';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadProject } from '@docsandeye/core';
import type { RenderManifest } from '../src/data.ts';
import {
  encodePathSegments,
  isImageOutput,
  isViewableModel,
  renderJobFor,
  renderPresentation,
  renderUrl,
  withBase,
} from '../src/view.ts';

const execFileP = promisify(execFile);
const BUILD_TIMEOUT = 600_000;

vi.setConfig({ testTimeout: BUILD_TIMEOUT, hookTimeout: BUILD_TIMEOUT });

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES_DIR = path.join(PKG_ROOT, 'test/fixtures');
const PROJECT_DIR = path.join(FIXTURES_DIR, 'project-render-urls');
const SITE_SRC_DIR = path.join(FIXTURES_DIR, 'site-render-urls');
const SITE_SCRATCH_DIR = path.join(FIXTURES_DIR, 'site-render-urls-scratch'); // ephemeral; never committed
const DIST = path.join(SITE_SCRATCH_DIR, 'dist');

// From the fixture YAML and `build/render/manifest.json`.
const ODD_FILE = 'Components/Odd Cap/Odd Cap #1 v2.stl';
const ODD_BASENAME = 'Odd Cap #1 v2.stl';
const ODD_URL = '/_docsandeye/render/Odd%20Cap%20%231%20v2.stl';
const KIT_STL_BASENAME = 'Model Kit v3.stl';
const KIT_GLB_BASENAME = 'Model Kit v3.glb';
const KIT_GLB_URL = '/_docsandeye/render/Model%20Kit%20v3.glb';
const PLAIN_BASENAME = 'plain-cap@2.0.0--plain-iso--63ccca40d91f.png';
const PLAIN_URL = '/_docsandeye/render/plain-cap%402.0.0--plain-iso--63ccca40d91f.png';

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

const model = loadProject(PROJECT_DIR);
const manifest = JSON.parse(
  fs.readFileSync(path.join(PROJECT_DIR, 'build/render/manifest.json'), 'utf8'),
) as RenderManifest;

// ---------------------------------------------------------------------------
// The fixture really is the awkward case.
// ---------------------------------------------------------------------------

describe('fixture precondition', () => {
  it('loads without problems', () => {
    expect(model.problems).toEqual([]);
  });

  it('odd-cap is hand-exported and STL-only, with a space and a "#" in the basename', () => {
    const odd = model.components.get('odd-cap')!;
    expect(odd.master_format).toBe('f3z');
    expect(odd.derived_files).toEqual([ODD_FILE]);
    expect(ODD_BASENAME).toContain(' ');
    expect(ODD_BASENAME).toContain('#');
  });

  it('model-kit is hand-exported with an STL first and a GLB beside it', () => {
    const kit = model.components.get('model-kit')!;
    expect(kit.master_format).toBe('f3z');
    expect(kit.derived_files).toEqual([
      `Components/Model Kit/${KIT_STL_BASENAME}`,
      `Components/Model Kit/${KIT_GLB_BASENAME}`,
    ]);
  });

  it('the step declares all three renders and the manifest has a job for each', () => {
    const step = model.steps.get('step-01-encode')!;
    expect(step.renders.map((r) => r.id)).toEqual(['odd-front', 'kit-iso', 'plain-iso']);
    expect(Object.keys(manifest.jobs)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Pure encoding
// ---------------------------------------------------------------------------

describe('encodePathSegments', () => {
  it('encodes each segment and keeps the separators', () => {
    expect(encodePathSegments('Components/Odd Cap/Odd Cap #1 v2.stl')).toBe(
      'Components/Odd%20Cap/Odd%20Cap%20%231%20v2.stl',
    );
  });

  it('encodes the characters that would otherwise change what the URL means', () => {
    expect(encodePathSegments('a#b')).toBe('a%23b');
    expect(encodePathSegments('a?b')).toBe('a%3Fb');
    expect(encodePathSegments('a b')).toBe('a%20b');
    expect(encodePathSegments('100%')).toBe('100%25');
    expect(encodePathSegments('a&b')).toBe('a%26b');
  });

  it('leaves an already-safe path alone and keeps trailing slashes', () => {
    expect(encodePathSegments('AEP/step-01-raft/')).toBe('AEP/step-01-raft/');
    expect(encodePathSegments('')).toBe('');
  });
});

describe('withBase', () => {
  it('encodes the path but passes the site base through as authored', () => {
    expect(withBase('/_docsandeye/render/Odd Cap #1 v2.stl')).toBe(ODD_URL);
    expect(withBase('/_docsandeye/render/Odd Cap #1 v2.stl', '/docs/')).toBe(`/docs${ODD_URL}`);
  });
});

describe('renderUrl', () => {
  it('encodes the first output basename', () => {
    expect(renderUrl({ status: 'hand-exported', outputs: [ODD_FILE] })).toBe(ODD_URL);
  });

  it('encodes the "@" of a rendered job key', () => {
    expect(renderUrl({ status: 'rendered', outputs: [`build/render/${PLAIN_BASENAME}`] })).toBe(PLAIN_URL);
  });

  it('is undefined for a job with no outputs', () => {
    expect(renderUrl({ status: 'failed', outputs: [] })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Which element a render output deserves
// ---------------------------------------------------------------------------

describe('isImageOutput / isViewableModel', () => {
  it('treats the browser-renderable raster and vector formats as images', () => {
    for (const ext of ['png', 'svg', 'webp', 'avif', 'jpg', 'jpeg']) {
      expect(isImageOutput(`a/b/thing.${ext}`), ext).toBe(true);
      expect(isImageOutput(`a/b/thing.${ext.toUpperCase()}`), `${ext} uppercase`).toBe(true);
    }
  });

  it('treats geometry as not an image', () => {
    for (const ext of ['stl', 'step', 'stp', '3mf', 'glb', 'gltf']) {
      expect(isImageOutput(`a/b/thing.${ext}`), ext).toBe(false);
    }
  });

  it('only glb and gltf can be shown by the viewer', () => {
    expect(isViewableModel('a/Model Kit v3.glb')).toBe(true);
    expect(isViewableModel('a/Model Kit v3.gltf')).toBe(true);
    for (const ext of ['stl', 'step', 'stp', '3mf', 'png']) {
      expect(isViewableModel(`a/thing.${ext}`), ext).toBe(false);
    }
  });
});

describe('renderPresentation', () => {
  const jobFor = (renderId: string) => {
    const render = model.steps.get('step-01-encode')!.renders.find((r) => r.id === renderId)!;
    const found = renderJobFor(model, manifest, render.component, render.id, {
      annotate: render.annotate,
      explode: render.explode,
      format: render.format,
      view: render.view,
    })!;
    return { job: found.job!, component: model.components.get(render.component)! };
  };

  it('an image output stays an image', () => {
    const { job, component } = jobFor('plain-iso');
    expect(renderPresentation(job, component)).toEqual({ kind: 'image', url: PLAIN_URL });
  });

  it('an STL-only hand export becomes a download of the encoded URL', () => {
    const { job, component } = jobFor('odd-front');
    expect(renderPresentation(job, component)).toEqual({
      kind: 'download',
      url: ODD_URL,
      filename: ODD_BASENAME,
    });
  });

  it('a hand export with a GLB beside the STL becomes a model pointing at the GLB', () => {
    const { job, component } = jobFor('kit-iso');
    expect(renderPresentation(job, component)).toEqual({ kind: 'model', url: KIT_GLB_URL });
  });

  it('is undefined for a job with no outputs', () => {
    expect(renderPresentation({ status: 'failed', outputs: [] }, undefined)).toBeUndefined();
  });

  it('finds a GLB the job itself writes even without the component', () => {
    expect(renderPresentation({ status: 'rendered', outputs: ['build/render/a b.glb'] }, undefined)).toEqual({
      kind: 'model',
      url: '/_docsandeye/render/a%20b.glb',
    });
  });
});

// ---------------------------------------------------------------------------
// The built page
// ---------------------------------------------------------------------------

describe('built page: /ENC/step-01-encode/', () => {
  const PAGE = 'ENC/step-01-encode/index.html';

  it('the fixture site builds', () => {
    expect(buildOk).toBe(true);
  });

  it('no render is reported missing', () => {
    expect(readHtml(PAGE).querySelector('.docsi-render-missing')).toBeFalsy();
  });

  it('the STL-only render is a download link with the encoded href, not an <img>', () => {
    const figure = readHtml(PAGE).querySelector('figure.docsi-render[data-render="odd-front"]')!;
    expect(figure, 'expected a figure for odd-front').toBeTruthy();
    expect(figure.querySelector('img')).toBeFalsy();
    const link = figure.querySelector('a.docsi-download')!;
    expect(link.getAttribute('href')).toBe(ODD_URL);
    expect(link.text.replace(/\s+/g, ' ').trim()).toBe(`Download ${ODD_BASENAME}`);
    expect(figure.querySelector('figcaption')!.text.trim()).toBe('odd-front');
  });

  it('the hand export with a GLB is a <docsi-model> with the encoded src and a download link', () => {
    const figure = readHtml(PAGE).querySelector('figure.docsi-render[data-render="kit-iso"]')!;
    expect(figure, 'expected a figure for kit-iso').toBeTruthy();
    expect(figure.querySelector('img')).toBeFalsy();
    const viewer = figure.querySelector('docsi-model')!;
    expect(viewer.getAttribute('data-src')).toBe(KIT_GLB_URL);
    const link = viewer.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(KIT_GLB_URL);
    expect(link.text.trim()).toBe('Download 3D model');
  });

  it('the rendered PNG is still an <img>, with its "@" encoded', () => {
    const img = readHtml(PAGE).querySelector('figure.docsi-render[data-render="plain-iso"] img')!;
    expect(img.getAttribute('src')).toBe(PLAIN_URL);
    expect(img.getAttribute('alt')).toBe('plain-iso');
  });

  it('nothing on the page puts geometry in an <img>', () => {
    for (const img of readHtml(PAGE).querySelectorAll('img')) {
      const src = decodeURIComponent(img.getAttribute('src') ?? '');
      expect(src, `<img src="${src}">`).not.toMatch(/\.(stl|step|stp|3mf|glb|gltf)$/i);
    }
  });

  it('the raw HTML carries the escapes, so no "#" can truncate an href', () => {
    const raw = fs.readFileSync(path.join(DIST, PAGE), 'utf8');
    expect(raw).toContain(`href="${ODD_URL}"`);
    expect(raw).not.toContain(`href="/_docsandeye/render/${ODD_BASENAME}"`);
  });
});

// ---------------------------------------------------------------------------
// What the copy step wrote
// ---------------------------------------------------------------------------

describe('copied files keep their unencoded on-disk names', () => {
  for (const name of [ODD_BASENAME, KIT_STL_BASENAME, KIT_GLB_BASENAME, PLAIN_BASENAME]) {
    it(`dist/_docsandeye/render/${name} exists`, () => {
      expect(fs.existsSync(path.join(DIST, '_docsandeye/render', name))).toBe(true);
    });
  }

  it('no percent-escaped name was written to disk', () => {
    const names = fs.readdirSync(path.join(DIST, '_docsandeye/render'));
    expect(names.filter((n) => n.includes('%20') || n.includes('%23') || n.includes('%40'))).toEqual([]);
  });

  it('the copied file is byte-identical to the fixture derived file', () => {
    expect(fs.readFileSync(path.join(DIST, '_docsandeye/render', ODD_BASENAME))).toEqual(
      fs.readFileSync(path.join(PROJECT_DIR, ODD_FILE)),
    );
  });
});
