/**
 * Tester suite — unit-level acceptance criteria (no `astro build`).
 * Covers AC1 (registration), AC2 (schema), AC5 (source-level import checks),
 * AC11 (config:setup hook unit test), AC12 (virtual module contract), AC13
 * (package hygiene). Build-dependent criteria live in build.test.ts.
 *
 * Independence note: everything here is read from spec.md, fixtures, and
 * plugin source (never from executing the plugin's own build pipeline).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import docsandeye, { PLUGIN_NAME } from '../index.ts';
import { createDocsandeyeVitePlugin, loadDocsandeyeData, VIRTUAL_MODULE_ID } from '../index.ts';
import { stepFrontmatterSchema } from '../schema.ts';
import { readFrontmatter } from '@docsandeye/core';

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const PROJECT_DIR = path.join(PKG_ROOT, 'fixtures/project');
const SITE_DIR = path.join(PKG_ROOT, 'fixtures/site');

// ---------------------------------------------------------------------------
// AC1: Plugin registration
// ---------------------------------------------------------------------------

describe('AC1 plugin registration', () => {
  it("docsandeye() returns an object with name 'starlight-docsandeye' and a config:setup hook function", () => {
    const plugin = docsandeye();
    expect(plugin.name).toBe('starlight-docsandeye');
    expect(PLUGIN_NAME).toBe('starlight-docsandeye');
    expect(typeof plugin.hooks?.['config:setup']).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// AC2: Schema export — stepFrontmatterSchema against fixtures/step-cases.json
// ---------------------------------------------------------------------------

interface StepCases {
  valid: string[];
  invalid: { name: string; input: Record<string, unknown>; path: string }[];
}

const stepCases: StepCases = JSON.parse(readFileSync(path.join(PKG_ROOT, 'fixtures/step-cases.json'), 'utf8'));

describe('AC2 schema export: stepFrontmatterSchema', () => {
  for (const rel of stepCases.valid) {
    it(`validates the frontmatter of ${rel}`, () => {
      const text = readFileSync(path.join(PROJECT_DIR, rel), 'utf8');
      const { data } = readFrontmatter(text, rel);
      const result = stepFrontmatterSchema.safeParse(data);
      expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
    });
  }

  for (const testCase of stepCases.invalid) {
    it(`rejects: ${testCase.name}`, () => {
      const result = stepFrontmatterSchema.safeParse(testCase.input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((issue) => issue.path.join('.'));
        expect(paths).toContain(testCase.path);
      }
    });
  }

  it('filename-dependent checks (id vs filename) are not part of this schema', () => {
    // A frontmatter object whose id does not match any filename must still validate:
    // the id/filename check is core's parseStep responsibility, not this schema's.
    const result = stepFrontmatterSchema.safeParse({ id: 'totally-different-id', order: 1, title: 'X' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC5 (source-level portion): no static import of three/model-viewer in the
// custom elements; the only reference is a dynamic import() in docsi-model.ts,
// positioned after that file's first addEventListener(.
// ---------------------------------------------------------------------------

describe('AC5 source-level: custom elements have no static 3D-library import', () => {
  const elementsDir = path.join(PKG_ROOT, 'src/elements');
  const files = ['index.ts', 'docsi-step.ts', 'docsi-model.ts', 'docsi-lightbox.ts'];
  const IMPORT_RE = /^\s*import\b[^;\n]*?['"]([^'"]+)['"]/gm;

  for (const file of files) {
    it(`${file} has no static import specifier containing "three" or "model-viewer"`, () => {
      const source = readFileSync(path.join(elementsDir, file), 'utf8');
      const specifiers: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = IMPORT_RE.exec(source))) {
        specifiers.push(match[1]!);
      }
      for (const specifier of specifiers) {
        expect(specifier).not.toMatch(/three/i);
        expect(specifier).not.toMatch(/model-viewer/i);
      }
    });
  }

  it('docsi-model.ts: the first addEventListener( occurs before the first import(', () => {
    const source = readFileSync(path.join(elementsDir, 'docsi-model.ts'), 'utf8');
    const addEventListenerIndex = source.indexOf('addEventListener(');
    const importCallIndex = source.indexOf('import(');
    expect(addEventListenerIndex).toBeGreaterThanOrEqual(0);
    expect(importCallIndex).toBeGreaterThanOrEqual(0);
    expect(importCallIndex).toBeGreaterThan(addEventListenerIndex);
  });

  it('docsi-model.ts is the only file referencing a 3D viewer library, via dynamic import()', () => {
    const source = readFileSync(path.join(elementsDir, 'docsi-model.ts'), 'utf8');
    expect(source).toMatch(/import\(\s*['"][^'"]*model-viewer[^'"]*['"]\s*\)/);
    for (const file of ['index.ts', 'docsi-step.ts', 'docsi-lightbox.ts']) {
      const other = readFileSync(path.join(elementsDir, file), 'utf8');
      expect(other).not.toMatch(/model-viewer/i);
      expect(other).not.toMatch(/\bthree\b/i);
    }
  });
});

// ---------------------------------------------------------------------------
// AC11 (unit-test portion): config:setup hook, recording updateConfig, with a
// pre-existing user components.ThemeSelect override that must survive.
// ---------------------------------------------------------------------------

describe('AC11 theme wiring: config:setup hook', () => {
  it('merges customCss (ending …docsandeye.css, …theme-starlight.css) and components (Sidebar added, user ThemeSelect kept)', () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    const updateConfig = (patch: Record<string, unknown>) => {
      updateCalls.push(patch);
    };
    const userConfig = {
      customCss: [],
      components: { ThemeSelect: './my/ThemeSelect.astro' },
    };
    const params = {
      config: userConfig,
      updateConfig,
      addIntegration: () => {},
      logger: { info: () => {}, warn: () => {} },
      astroConfig: { root: pathToFileURL(`${SITE_DIR}/`) },
    };

    const plugin = docsandeye({ projectRoot: '../project' });
    const hook = plugin.hooks?.['config:setup'] as (p: typeof params) => void;
    hook(params);

    expect(updateCalls.length).toBeGreaterThan(0);
    const merged = updateCalls.reduce((acc, call) => ({ ...acc, ...call }), {} as Record<string, unknown>);

    const customCss = merged.customCss as string[];
    expect(Array.isArray(customCss)).toBe(true);
    expect(customCss.length).toBeGreaterThanOrEqual(2);
    expect(customCss[customCss.length - 2]).toMatch(/docsandeye\.css$/);
    expect(customCss[customCss.length - 1]).toMatch(/theme-starlight\.css$/);

    const components = merged.components as Record<string, string>;
    expect(components.Sidebar).toMatch(/Sidebar\.astro$/);
    // The user's own ThemeSelect override must survive the merge untouched.
    expect(components.ThemeSelect).toBe('./my/ThemeSelect.astro');
  });
});

// ---------------------------------------------------------------------------
// AC12: Virtual module contract
// ---------------------------------------------------------------------------

describe('AC12 virtual module contract', () => {
  it('resolveId/load serve virtual:docsandeye/model, and the module evaluates via a data: URL import()', async () => {
    const data = loadDocsandeyeData(PROJECT_DIR, { DOCSANDEYE_BUILD_DATE: '2026-09-04' });
    const plugin = createDocsandeyeVitePlugin(data);

    const resolved = plugin.resolveId(VIRTUAL_MODULE_ID);
    expect(resolved).toBeTruthy();

    const code = plugin.load(resolved as string);
    expect(typeof code).toBe('string');
    expect(code!.length).toBeGreaterThan(0);

    const dataUrl = `data:text/javascript;base64,${Buffer.from(code as string, 'utf8').toString('base64')}`;
    const mod = (await import(/* @vite-ignore */ dataUrl)) as Record<string, unknown>;

    for (const key of ['config', 'model', 'staleness', 'renderManifest', 'carbon', 'buildDate', 'maintainer']) {
      expect(mod[key], `expected export "${key}"`).not.toBeUndefined();
    }

    const staleness = mod.staleness as Record<string, { status: string }>;
    expect(staleness['photo-02-cap']?.status).toBe('STALE');
    expect(mod.buildDate).toBe('2026-09-04');
    expect(mod.maintainer).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC13: Package hygiene (dependency fields only; build/test invocation is
// covered by the harness running this suite itself, not re-tested here).
// ---------------------------------------------------------------------------

describe('AC13 package hygiene', () => {
  const forbidden = ['sharp', 'lit', 'react', 'preact', 'vue', 'svelte'];
  const depFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

  it('package.json lists none of sharp/lit/react/preact/vue/svelte in any dependency field', () => {
    const pkg = JSON.parse(readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
    for (const field of depFields) {
      const deps: Record<string, string> = pkg[field] ?? {};
      for (const name of forbidden) {
        expect(Object.keys(deps), `${field} should not include "${name}"`).not.toContain(name);
      }
    }
  });
});
