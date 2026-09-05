/**
 * Hand-exported components resolve by outputs, not by job key.
 *
 * Since core's render plan de-duplicates hand-exported jobs (`f3z`/`none`
 * masters, whose outputs are the component's `derived_files`), a component
 * referenced by several renders — or by a render and a viewer — gets ONE
 * manifest job, keyed on whichever reference sorted first. Resolving each
 * reference by `renderJobKey` therefore found nothing for the others, and the
 * page silently rendered no figure. The plugin must instead resolve a
 * hand-exported reference by the job whose outputs are the derived files.
 *
 * The fixture case: `fixtures/project`'s `blank-cap` (master_format `f3z`,
 * one derived STL) is referenced three times — renders `blank-front` and
 * `blank-iso` on step-01-raft, and a viewer on step-03-mep-only — while
 * `build/render/manifest.json` holds a single job for it.
 *
 * Independence note: expected values come from the fixture YAML/Markdown/JSON
 * and from core's own `renderJobKey`, never from running the plugin and
 * reading back whatever it produced.
 *
 * `fixtures/site` is ALSO built by `build.test.ts` (and by `video.test.ts`'s
 * and `diff.test.ts`'s own scratch copies). Building the very same fixture
 * directory concurrently races Vite's dependency cache and the dist-assembly
 * rename (see `video.test.ts`'s comment for the observed failure modes), so
 * this file builds its own ephemeral sibling copy under a name no other test
 * file uses.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse } from 'node-html-parser';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadProject, renderJobKey } from '@docsandeye/core';
import type { RenderManifest } from '../src/data.ts';
import { handExportedJobFor, isHandExported, renderJobFor, renderUrl } from '../src/view.ts';

const execFileP = promisify(execFile);
const BUILD_TIMEOUT = 600_000;

vi.setConfig({ testTimeout: BUILD_TIMEOUT, hookTimeout: BUILD_TIMEOUT });

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES_DIR = path.join(PKG_ROOT, 'fixtures');
const PROJECT_DIR = path.join(FIXTURES_DIR, 'project');
const SITE_SRC_DIR = path.join(FIXTURES_DIR, 'site');
const SITE_SCRATCH_DIR = path.join(FIXTURES_DIR, 'site-tester-scratch-handexported'); // ephemeral; never committed
const DIST = path.join(SITE_SCRATCH_DIR, 'dist');

/** From `fixtures/project/docs/components/blank-cap.yaml`. */
const DERIVED_FILE = 'Components/BlankCap/BlankCap v1.stl';
/** `renderUrl`'s form: the derived file's basename under the render prefix, percent-encoded. */
const DERIVED_URL = '/_docsandeye/render/BlankCap%20v1.stl';
/** The basename as it is on disk, which the copy step never encodes. */
const DERIVED_BASENAME = 'BlankCap v1.stl';

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
// The fixture really is the collapsed case (otherwise nothing below proves
// anything): one manifest job for three references, and it is NOT under the
// key two of them compute.
// ---------------------------------------------------------------------------

describe('fixture precondition: one hand-exported job for three references', () => {
  const blankCap = model.components.get('blank-cap')!;

  it('blank-cap is hand-exported with the derived STL as its only derived file', () => {
    expect(blankCap.master_format).toBe('f3z');
    expect(isHandExported(blankCap)).toBe(true);
    expect(blankCap.derived_files).toEqual([DERIVED_FILE]);
  });

  it('the three references are two renders on step-01-raft and a viewer on step-03-mep-only', () => {
    const raft = model.steps.get('step-01-raft')!;
    const blankRenders = raft.renders.filter((r) => r.component === 'blank-cap');
    expect(blankRenders.map((r) => r.id)).toEqual(['blank-front', 'blank-iso']);
    expect(model.steps.get('step-03-mep-only')!.viewer?.component).toBe('blank-cap');
  });

  it('the render manifest holds exactly one job writing the derived file', () => {
    const writing = Object.entries(manifest.jobs).filter(([, job]) => job.outputs.includes(DERIVED_FILE));
    expect(writing).toHaveLength(1);
    expect(writing[0]![1].status).toBe('hand-exported');
  });

  it('two of the three references have no manifest job under their own renderJobKey', () => {
    const blankCap = model.components.get('blank-cap')!;
    const frontKey = renderJobKey(blankCap, 'blank-front', { annotate: false, explode: false, format: 'stl', view: 'front' });
    const isoKey = renderJobKey(blankCap, 'blank-iso', { annotate: false, explode: false, format: 'stl', view: 'iso' });
    const viewerKey = renderJobKey(blankCap, 'viewer', { format: 'stl' });
    expect(Object.keys(manifest.jobs)).toContain(frontKey);
    expect(Object.keys(manifest.jobs)).not.toContain(isoKey);
    expect(Object.keys(manifest.jobs)).not.toContain(viewerKey);
  });
});

// ---------------------------------------------------------------------------
// Pure resolution: renderJobFor and handExportedJobFor
// ---------------------------------------------------------------------------

describe('renderJobFor: hand-exported references resolve by outputs', () => {
  const references: Array<{ label: string; renderId: string; options: Parameters<typeof renderJobKey>[2] }> = [
    { label: 'render blank-front', renderId: 'blank-front', options: { annotate: false, explode: false, format: 'stl', view: 'front' } },
    { label: 'render blank-iso', renderId: 'blank-iso', options: { annotate: false, explode: false, format: 'stl', view: 'iso' } },
    { label: 'viewer', renderId: 'viewer', options: { format: 'stl' } },
  ];

  for (const { label, renderId, options } of references) {
    it(`${label} resolves to the job writing ${DERIVED_FILE}`, () => {
      const found = renderJobFor(model, manifest, 'blank-cap', renderId, options);
      expect(found?.job, `${label} should resolve to a job`).toBeDefined();
      expect(found!.job!.outputs).toEqual([DERIVED_FILE]);
      expect(renderUrl(found!.job!)).toBe(DERIVED_URL);
    });
  }

  it('all three references resolve to the same manifest job', () => {
    const keys = references.map(({ renderId, options }) => renderJobFor(model, manifest, 'blank-cap', renderId, options)!.key);
    expect(new Set(keys).size).toBe(1);
  });

  it('a rendered component still resolves by job key, not by outputs', () => {
    const vialCap = model.components.get('vial-cap')!;
    expect(isHandExported(vialCap)).toBe(false);
    const key = renderJobKey(vialCap, 'cap-iso', { annotate: false, explode: false, format: 'png', view: 'iso' });
    const found = renderJobFor(model, manifest, 'vial-cap', 'cap-iso', { annotate: false, explode: false, format: 'png', view: 'iso' });
    expect(found?.key).toBe(key);
    expect(found?.job?.outputs).toEqual([`build/render/${key}.png`]);

    // A render id that produced no job stays unresolved rather than borrowing
    // some other job's outputs.
    expect(renderJobFor(model, manifest, 'vial-cap', 'cap-front', { annotate: false, explode: false, format: 'png', view: 'front' })?.job).toBeUndefined();
  });
});

describe('handExportedJobFor', () => {
  it('matches the whole outputs list ahead of a partial first-output match', () => {
    const twoFile: RenderManifest = {
      version: 1,
      jobs: {
        'a--first': { status: 'hand-exported', outputs: [DERIVED_FILE] },
        'b--second': { status: 'hand-exported', outputs: [DERIVED_FILE, 'Components/BlankCap/BlankCap v1.png'] },
      },
    };
    const component = { derived_files: [DERIVED_FILE, 'Components/BlankCap/BlankCap v1.png'] };
    expect(handExportedJobFor(twoFile, component)?.key).toBe('b--second');
  });

  it('falls back to the first job (in key order) whose first output matches', () => {
    const manifestOnlyFirst: RenderManifest = {
      version: 1,
      jobs: {
        'z--late': { status: 'hand-exported', outputs: [DERIVED_FILE, 'extra.png'] },
        'a--early': { status: 'hand-exported', outputs: [DERIVED_FILE, 'other.png'] },
      },
    };
    expect(handExportedJobFor(manifestOnlyFirst, { derived_files: [DERIVED_FILE] })?.key).toBe('a--early');
  });

  it('is undefined without a manifest, without derived files, or when nothing writes them', () => {
    expect(handExportedJobFor(null, { derived_files: [DERIVED_FILE] })).toBeUndefined();
    expect(handExportedJobFor(manifest, { derived_files: [] })).toBeUndefined();
    expect(handExportedJobFor(manifest, { derived_files: ['Components/Nope/Nope.stl'] })).toBeUndefined();
  });

  it('a hand-exported component with no derived files falls back to the key lookup and finds nothing', () => {
    // anode is master_format `none` with no derived_files, and no step renders it.
    const anode = model.components.get('anode')!;
    expect(isHandExported(anode)).toBe(true);
    expect(anode.derived_files).toEqual([]);
    expect(renderJobFor(model, manifest, 'anode', 'viewer', { format: 'glb' })?.job).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Built pages: every reference renders a figure or viewer pointing at the
// derived file, and none reports the render as missing.
// ---------------------------------------------------------------------------

describe('built pages: every hand-exported reference renders', () => {
  it('the fixture site builds', () => {
    expect(buildOk).toBe(true);
  });

  for (const page of ['AEP/step-01-raft/index.html', 'MEP/step-01-raft/index.html']) {
    // blank-cap's only derived file is an STL, which is not an image: the figure
    // is a download link, not an `<img>` (see `render-urls.test.ts`). What this
    // file pins is that all three references still RESOLVE — a figure exists for
    // each, pointing at the derived file.
    it(`${page}: both blank-cap renders are figures pointing at the derived file`, () => {
      const doc = readHtml(page);
      for (const renderId of ['blank-front', 'blank-iso']) {
        const figure = doc.querySelector(`figure.docsi-render[data-render="${renderId}"]`);
        expect(figure, `expected a figure for render ${renderId}`).toBeTruthy();
        expect(figure!.querySelector('img'), 'an STL must not be put in an <img>').toBeFalsy();
        const link = figure!.querySelector('a.docsi-download');
        expect(link?.getAttribute('href')).toBe(DERIVED_URL);
        expect(link?.text.replace(/\s+/g, ' ').trim()).toBe(`Download ${DERIVED_BASENAME}`);
        expect(figure!.querySelector('figcaption')?.text.trim()).toBe(renderId);
      }
      expect(doc.querySelector('.docsi-render-missing')).toBeFalsy();
    });
  }

  // The viewer goes through `renderPresentation` too: blank-cap's only derived
  // file is an STL, which `<docsi-model>`'s viewer cannot load, so the step
  // viewer is the labelled download link — not an empty viewer box.
  it('MEP/step-03-mep-only: the STL-only viewer is a labelled download link, not a <docsi-model>', () => {
    const doc = readHtml('MEP/step-03-mep-only/index.html');
    expect(doc.querySelector('docsi-model'), 'an STL must not be handed to the 3D viewer').toBeFalsy();
    const link = doc.querySelector('a.docsi-download');
    expect(link, 'expected a download link for the step viewer').toBeTruthy();
    expect(link!.getAttribute('href')).toBe(DERIVED_URL);
    expect(link!.text.replace(/\s+/g, ' ').trim()).toBe(`Download ${DERIVED_BASENAME}`);
    expect(doc.querySelector('.docsi-render-missing')).toBeFalsy();
  });

  it('MEP/step-03-mep-only: no <img> points at the STL either', () => {
    for (const img of readHtml('MEP/step-03-mep-only/index.html').querySelectorAll('img')) {
      const src = decodeURIComponent(img.getAttribute('src') ?? '');
      expect(src, `<img src="${src}">`).not.toMatch(/\.(stl|step|stp|3mf)$/i);
    }
  });

  it('the derived file is copied into dist/_docsandeye/render/ under its unencoded name', () => {
    expect(fs.existsSync(path.join(DIST, '_docsandeye/render', DERIVED_BASENAME))).toBe(true);
  });

  // The other half of the same rule: a viewer whose resolved output IS a
  // viewable model keeps `<docsi-model>` and its light-DOM download link.
  it('the vial-cap render and viewer on step-02-cap are unaffected', () => {
    const doc = readHtml('AEP/step-02-cap/index.html');
    expect(doc.querySelector('figure.docsi-render[data-render="cap-iso"] img')?.getAttribute('src')).toBe(
      '/_docsandeye/render/vial-cap%402.0.0--cap-iso--0fd0f88538ea.png',
    );
    const viewer = doc.querySelector('docsi-model');
    expect(viewer, 'a GLB viewer must still be a docsi-model').toBeTruthy();
    expect(viewer!.getAttribute('data-src')).toBe('/_docsandeye/render/vial-cap%402.0.0--viewer--d2ced720dce2.glb');
    const link = viewer!.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/_docsandeye/render/vial-cap%402.0.0--viewer--d2ced720dce2.glb');
    expect(link?.text.trim()).toBe('Download 3D model');
    expect(doc.querySelector('a.docsi-download')).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// The download link is styled: it is now the only thing a viewer or a figure
// shows for a non-image, non-viewable derived file, so unstyled it is a bare
// browser-default link inside the media column.
// ---------------------------------------------------------------------------

function walkCss(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkCss(dir, next));
    else if (entry.name.endsWith('.css')) out.push(next);
  }
  return out;
}

describe('.docsi-download is styled from the existing tokens', () => {
  const builtCss = (): string => {
    const files = walkCss(DIST);
    expect(files.length, 'expected at least one built stylesheet').toBeGreaterThan(0);
    return files.map((f) => fs.readFileSync(path.join(DIST, f), 'utf8')).join('\n').replace(/\s+/g, '');
  };

  it('the built CSS carries a .docsi-download rule with the accent colour and padding', () => {
    // The minifier may reorder declarations, so assert on the rule body rather
    // than a fixed property order.
    const match = /(?:^|[};])\.docsi-download\{([^}]*)\}/.exec(builtCss());
    expect(match, 'expected a .docsi-download{...} rule in the built CSS').toBeTruthy();
    expect(match![1]).toContain('color:var(--docsi-accent-high)');
    expect(match![1]).toContain('background:var(--docsi-bg)');
    expect(match![1]).toMatch(/padding:/);
  });

  it('the standalone viewer link gets the same card border as docsi-model', () => {
    const match = /\.docsi-media>\.docsi-download\{([^}]*)\}/.exec(builtCss());
    expect(match, 'expected a .docsi-media > .docsi-download rule').toBeTruthy();
    expect(match![1]).toContain('var(--sl-color-hairline)');
  });

  it('the rule defines no new --docsi-* token', () => {
    const source = fs.readFileSync(path.join(PKG_ROOT, 'src/styles/docsandeye.css'), 'utf8');
    const rules = source.match(/\.docsi-download[^{]*\{[^}]*\}/g) ?? [];
    expect(rules.length, 'expected .docsi-download rules in the source stylesheet').toBeGreaterThan(0);
    for (const rule of rules) expect(rule, rule).not.toMatch(/--docsi-[a-z-]+\s*:/);
  });
});
