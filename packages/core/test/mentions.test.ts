/**
 * `unmentionedComponents`: a step part or tool the body never names, by
 * component name or id, whole words, any case. Pure; models built from
 * parsed files, no filesystem.
 */
import { describe, expect, it } from 'vitest';
import { mentionsComponent, parseComponent, parseStep, unmentionedComponents, type ProjectModel } from '../src/index.js';

function component(id: string, name: string) {
  return parseComponent(`id: ${id}\nname: ${name}\nkind: off-the-shelf\ndesign_version: 1.0.0\nmaster_format: none\n`, `docs/components/${id}.yaml`);
}

function modelOf(steps: string[]): ProjectModel {
  const components = [component('vial-cap', 'Vial Cap'), component('m3-bolt', 'M3 bolt'), component('hex-key', 'Hex key (2.5 mm)')];
  const parsed = steps.map((text) => parseStep(text, `docs/steps/${/id: (\S+)/.exec(text)![1]}.md`));
  return {
    config: {} as ProjectModel['config'],
    components: new Map(components.map((c) => [c.id, c])),
    steps: new Map(parsed.map((s) => [s.id, s])),
    media: new Map(),
    problems: [],
  };
}

function step(id: string, frontmatter: string, body: string): string {
  return `---\nid: ${id}\norder: 1\ntitle: ${id}\n${frontmatter}\n---\n${body}\n`;
}

describe('mentionsComponent', () => {
  const cap = { id: 'vial-cap', name: 'Vial Cap' };

  it('matches the name or the id, ignoring case', () => {
    expect(mentionsComponent('Press the VIAL CAP home.', cap)).toBe(true);
    expect(mentionsComponent('Print vial-cap first.', cap)).toBe(true);
  });

  it('an id matches with its hyphens written as spaces', () => {
    expect(mentionsComponent('Tighten each M3 bolt.', { id: 'm3-bolt', name: 'Bolt, M3 x 8' })).toBe(true);
  });

  it('matches whole words only, across line breaks', () => {
    expect(mentionsComponent('the vial capsule', cap)).toBe(false);
    expect(mentionsComponent('a phial cap', cap)).toBe(false);
    expect(mentionsComponent('the vial\ncap', cap)).toBe(true);
    expect(mentionsComponent('[Vial Cap](../x.md)', cap)).toBe(true);
  });

  it('takes a name with punctuation literally', () => {
    expect(mentionsComponent('Use the hex key (2.5 mm).', { id: 'hex-key', name: 'Hex key (2.5 mm)' })).toBe(true);
    expect(mentionsComponent('Use the hex key.', { id: 'hex-key', name: 'Hex key (2.5 mm)' })).toBe(true);
    expect(mentionsComponent('Use the key.', { id: 'hex-key', name: 'Hex key (2.5 mm)' })).toBe(false);
  });
});

describe('unmentionedComponents', () => {
  it('warns once per part or tool the body never names', () => {
    const model = modelOf([
      step('step-01-a', 'parts:\n  - {component: vial-cap}\n  - {component: m3-bolt, qty: 4}\ntools:\n  - {component: hex-key}', 'Fit the vial cap.'),
    ]);
    expect(unmentionedComponents(model)).toEqual([
      { code: 'schema', file: 'docs/steps/step-01-a.md', path: 'parts.1.component', message: 'part "M3 bolt" (m3-bolt) is never mentioned in the step body' },
      { code: 'schema', file: 'docs/steps/step-01-a.md', path: 'tools.0.component', message: 'tool "Hex key (2.5 mm)" (hex-key) is never mentioned in the step body' },
    ]);
  });

  it('exempts cat: prev parts', () => {
    const model = modelOf([step('step-02-b', 'parts:\n  - {component: vial-cap, cat: prev}', 'Nothing named here.')]);
    expect(unmentionedComponents(model)).toEqual([]);
  });

  it('ignores HTML comments but counts when-block text', () => {
    const model = modelOf([
      step('step-03-c', 'parts:\n  - {component: vial-cap}\n  - {component: m3-bolt}', '<!-- TODO: mention the M3 bolt -->\n<!-- when units>=2 -->\nFit each vial cap.\n<!-- /when -->'),
    ]);
    expect(unmentionedComponents(model).map((p) => p.path)).toEqual(['parts.1.component']);
  });

  it('skips a reference to an unknown component (already an error)', () => {
    const model = modelOf([step('step-04-d', 'parts:\n  - {component: nowhere}', 'Text.')]);
    expect(unmentionedComponents(model)).toEqual([]);
  });
});
