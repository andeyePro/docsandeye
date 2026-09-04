import { describe, it, expect } from 'vitest';
import {
  parseComponent,
  parseStep,
  parseMedia,
  parseConfig,
  readFrontmatter,
  DEFAULT_DENYLIST,
  createHostingRegistry,
  resetHostingRegistry,
  registerHostingProvider,
  DocsiError,
} from '../src/index.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '../fixtures');

// AC1: Component schema
describe('AC1: Component schema', () => {
  it('parses valid component from minimal fixture', () => {
    const yaml = readFileSync(join(fixturesDir, 'minimal/docs/components/widget.yaml'), 'utf-8');
    const component = parseComponent(yaml, 'widget.yaml');
    expect(component).toMatchObject({
      id: 'widget',
      name: 'Widget',
      kind: 'printed',
      design_version: '1.0.0',
      master_format: 'scad',
      source_files: ['Components/Widget/Widget.scad'],
    });
    expect(component.changelog).toBeDefined();
    expect(component.changelog).toHaveLength(1);
    expect(component.changelog![0].version).toBe('1.0.0');
  });

  it('parses valid component from aep-like fixture', () => {
    const yaml = readFileSync(join(fixturesDir, 'aep-like/docs/components/electrode-top-stop.yaml'), 'utf-8');
    const component = parseComponent(yaml, 'electrode-top-stop.yaml');
    expect(component.id).toBe('electrode-top-stop');
    expect(component.design_version).toBe('2.0.0');
    // Changelog should be sorted ascending by version
    expect(component.changelog).toBeDefined();
    const versions = component.changelog!.map(e => e.version);
    expect(versions).toEqual(['1.0.0', '1.3.0', '2.0.0']);
  });

  it('rejects non-release-semver design_version', () => {
    const yaml = `id: test\nname: Test\nkind: printed\ndesign_version: 1.0.0-rc.1\nmaster_format: none\nsource_files: []`;
    expect(() => parseComponent(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('rejects id mismatch with filename', () => {
    const yaml = `id: other\nname: Test\nkind: printed\ndesign_version: 1.0.0\nmaster_format: none\nsource_files: []`;
    expect(() => parseComponent(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('rejects master_format scad with empty source_files', () => {
    const yaml = `id: test\nname: Test\nkind: printed\ndesign_version: 1.0.0\nmaster_format: scad\nsource_files: []`;
    expect(() => parseComponent(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('rejects master_format f3z with empty derived_files', () => {
    const yaml = `id: test\nname: Test\nkind: printed\ndesign_version: 1.0.0\nmaster_format: f3z\nsource_files: ["a.f3z"]\nderived_files: []`;
    expect(() => parseComponent(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('allows master_format none with empty source_files', () => {
    const yaml = `id: test\nname: Test\nkind: off-the-shelf\ndesign_version: 1.0.0\nmaster_format: none\nsource_files: []`;
    const component = parseComponent(yaml, 'test.yaml');
    expect(component.master_format).toBe('none');
    expect(component.source_files).toHaveLength(0);
  });

  it('rejects invalid supersedes format', () => {
    const yaml = `id: test\nname: Test\nkind: printed\ndesign_version: 1.0.0\nmaster_format: none\nsource_files: []\nsupersedes: invalid`;
    expect(() => parseComponent(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('rejects duplicate changelog versions', () => {
    const yaml = `id: test\nname: Test\nkind: printed\ndesign_version: 1.0.0\nmaster_format: none\nsource_files: []\nchangelog:\n  - {version: 1.0.0, date: 2026-01-01, note: "a"}\n  - {version: 1.0.0, date: 2026-01-02, note: "b"}`;
    expect(() => parseComponent(yaml, 'test.yaml')).toThrow(DocsiError);
  });
});

// AC2: Step schema
describe('AC2: Step schema', () => {
  it('parses valid step from minimal fixture', () => {
    const md = readFileSync(join(fixturesDir, 'minimal/docs/steps/step-01-print-widget.md'), 'utf-8');
    const step = parseStep(md, 'step-01-print-widget.md');
    expect(step.id).toBe('step-01-print-widget');
    expect(step.order).toBe(1);
    expect(step.title).toBe('Print the widget');
    expect(step.body).toBeTruthy();
    expect(step.parts).toBeDefined();
    expect(step.parts![0].qty).toBe(1);
    // guide is normalized to array or undefined by parseStep, default is applied in loadProject
  });

  it('normalises guide to string array', () => {
    const md = `---\nid: test\norder: 1\ntitle: T\nguide: aep\n---\nBody`;
    const step = parseStep(md, 'test.md');
    expect(step.guide).toEqual(['aep']);
  });

  it('applies render defaults', () => {
    const md = `---\nid: test\norder: 1\ntitle: T\nrenders:\n  - {id: r1, component: c1}\n---\nBody`;
    const step = parseStep(md, 'test.md');
    expect(step.renders![0]).toMatchObject({
      id: 'r1',
      component: 'c1',
      view: 'iso',
      explode: false,
      annotate: false,
      format: 'png',
    });
  });

  it('applies tool defaults', () => {
    const md = `---\nid: test\norder: 1\ntitle: T\ntools:\n  - {component: c1}\n---\nBody`;
    const step = parseStep(md, 'test.md');
    expect(step.tools![0]).toMatchObject({
      component: 'c1',
      qty: 1,
      cat: 'tool',
    });
  });

  it('applies viewer defaults', () => {
    const md = `---\nid: test\norder: 1\ntitle: T\nviewer: {component: c1}\n---\nBody`;
    const step = parseStep(md, 'test.md');
    expect(step.viewer!.format).toBe('glb');
  });

  it('rejects missing order', () => {
    const md = `---\nid: test\ntitle: T\n---\nBody`;
    expect(() => parseStep(md, 'test.md')).toThrow(DocsiError);
  });

  it('rejects duplicate render ids', () => {
    const md = `---\nid: test\norder: 1\ntitle: T\nrenders:\n  - {id: r1, component: c1}\n  - {id: r1, component: c2}\n---\nBody`;
    expect(() => parseStep(md, 'test.md')).toThrow(DocsiError);
  });

  it('rejects unknown view', () => {
    const md = `---\nid: test\norder: 1\ntitle: T\nrenders:\n  - {id: r1, component: c1, view: invalid}\n---\nBody`;
    expect(() => parseStep(md, 'test.md')).toThrow(DocsiError);
  });

  it('rejects unknown format', () => {
    const md = `---\nid: test\norder: 1\ntitle: T\nrenders:\n  - {id: r1, component: c1, format: invalid}\n---\nBody`;
    expect(() => parseStep(md, 'test.md')).toThrow(DocsiError);
  });
});

// AC3: Media schema
describe('AC3: Media schema', () => {
  it('parses valid video from minimal fixture', () => {
    const yaml = readFileSync(join(fixturesDir, 'minimal/docs/media/vid-001-widget-print.yaml'), 'utf-8');
    const media = parseMedia(yaml, 'vid-001-widget-print.yaml');
    expect(media.id).toBe('vid-001-widget-print');
    expect(media.type).toBe('video');
    expect(media.poster).toBeTruthy();
    expect(media.duration_s).toBe(12);
  });

  it('parses valid photo from aep-like fixture', () => {
    const yaml = readFileSync(join(fixturesDir, 'aep-like/docs/media/photo-003-lid-closed.yaml'), 'utf-8');
    const media = parseMedia(yaml, 'photo-003-lid-closed.yaml');
    expect(media.id).toBe('photo-003-lid-closed');
    expect(media.type).toBe('photo');
    expect(media.poster).toBeUndefined();
    expect(media.duration_s).toBeUndefined();
  });

  it('rejects video without poster', () => {
    const yaml = `id: test\ntype: video\nfile: a.mp4\nduration_s: 10\nshot_date: 2026-01-01\nshot_by: Me\nhero: [a@1.0.0]`;
    expect(() => parseMedia(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('rejects video without duration_s', () => {
    const yaml = `id: test\ntype: video\nfile: a.mp4\nposter: a.jpg\nshot_date: 2026-01-01\nshot_by: Me\nhero: [a@1.0.0]`;
    expect(() => parseMedia(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('rejects photo with poster', () => {
    const yaml = `id: test\ntype: photo\nfile: a.jpg\nposter: b.jpg\nshot_date: 2026-01-01\nshot_by: Me\nhero: [a@1.0.0]`;
    expect(() => parseMedia(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('rejects empty hero', () => {
    const yaml = `id: test\ntype: photo\nfile: a.jpg\nshot_date: 2026-01-01\nshot_by: Me\nhero: []`;
    expect(() => parseMedia(yaml, 'test.yaml')).toThrow(DocsiError);
  });

  it('rejects invalid pin format', () => {
    const yaml = `id: test\ntype: photo\nfile: a.jpg\nshot_date: 2026-01-01\nshot_by: Me\nhero: [invalid]`;
    expect(() => parseMedia(yaml, 'test.yaml')).toThrow(DocsiError);
  });
});

// AC4: Config schema
describe('AC4: Config schema', () => {
  it('parses config with defaults', () => {
    const yaml = `guides:\n  - {id: main, title: Main, base: /}`;
    const config = parseConfig(yaml);
    expect(config.theme).toBe('starlight');
    expect(config.byte_budget_kb).toBe(150);
    expect(config.hosting.provider).toBe('local');
  });

  it('merges DEFAULT_DENYLIST with user entries', () => {
    const yaml = `guides:\n  - {id: main, title: Main, base: /}\ndenylist: ["custom/**"]`;
    const config = parseConfig(yaml);
    expect(config.denylist).toContain('private-notes/**');
    expect(config.denylist).toContain('custom/**');
  });

  it('rejects empty guides', () => {
    const yaml = `guides: []`;
    expect(() => parseConfig(yaml)).toThrow(DocsiError);
  });

  it('rejects duplicate guide ids', () => {
    const yaml = `guides:\n  - {id: main, title: Main, base: /}\n  - {id: main, title: Dup, base: /dup}`;
    expect(() => parseConfig(yaml)).toThrow(DocsiError);
  });

  it('rejects base not starting with /', () => {
    const yaml = `guides:\n  - {id: main, title: Main, base: /}\n  - {id: other, title: Other, base: other}`;
    expect(() => parseConfig(yaml)).toThrow(DocsiError);
  });

  it('rejects unknown hosting provider', () => {
    const yaml = `guides:\n  - {id: main, title: Main, base: /}\nhosting:\n  provider: unknown`;
    expect(() => parseConfig(yaml)).toThrow(DocsiError);
  });

  it('rejects url-prefix without base', () => {
    const yaml = `guides:\n  - {id: main, title: Main, base: /}\nhosting:\n  provider: url-prefix`;
    expect(() => parseConfig(yaml)).toThrow(DocsiError);
  });

  it('accepts url-prefix with base', () => {
    const yaml = `guides:\n  - {id: main, title: Main, base: /}\nhosting:\n  provider: url-prefix\n  base: https://example.com`;
    const config = parseConfig(yaml);
    expect(config.hosting.provider).toBe('url-prefix');
    expect(config.hosting.base).toBe('https://example.com');
  });

  it('accepts custom provider via registry parameter', () => {
    const registry = createHostingRegistry();
    registerHostingProvider('custom', { name: 'custom', resolve: () => '' }, registry);
    const yaml = `guides:\n  - {id: main, title: Main, base: /}\nhosting:\n  provider: custom`;
    const config = parseConfig(yaml, { registry });
    expect(config.hosting.provider).toBe('custom');
  });

  it('default registry is independent from explicit registry', () => {
    const yaml = `guides:\n  - {id: main, title: Main, base: /}\nhosting:\n  provider: custom`;
    const registry = createHostingRegistry();
    registerHostingProvider('custom', { name: 'custom', resolve: () => '' }, registry);

    // With explicit registry, should work
    const config1 = parseConfig(yaml, { registry });
    expect(config1.hosting.provider).toBe('custom');

    // With default registry, should fail
    resetHostingRegistry();
    expect(() => parseConfig(yaml)).toThrow(DocsiError);
  });
});

// AC13: Frontmatter helper
describe('AC13: Frontmatter helper', () => {
  it('reads YAML frontmatter from start of file', () => {
    const text = `---\nkey: value\n---\nBody content here`;
    const result = readFrontmatter(text);
    expect(result.data).toEqual({ key: 'value' });
    expect(result.body).toBe('Body content here');
  });

  it('handles CRLF line endings', () => {
    const text = `---\r\nkey: value\r\n---\r\nBody content`;
    const result = readFrontmatter(text);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('returns empty data when no opening fence', () => {
    const text = `No fence here\n---\nBut closing fence exists`;
    const result = readFrontmatter(text);
    expect(result.data).toEqual({});
    expect(result.body).toBe(text);
  });

  it('throws on unterminated fence', () => {
    const text = `---\nkey: value\nNo closing fence`;
    expect(() => readFrontmatter(text)).toThrow(DocsiError);
  });

  it('extracts body after closing fence newline', () => {
    const text = `---\nkey: value\n---\nFirst line of body\nSecond line`;
    const result = readFrontmatter(text);
    expect(result.body).toBe('First line of body\nSecond line');
  });
});
