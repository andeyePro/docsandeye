/**
 * Tester suite for task_011 AC1: `buildDiffPlan` / `diffCandidates`
 * (`packages/core/src/diff-plan.ts`).
 *
 * Independence note: the hand-built model/staleness fixtures below and every
 * expected value (job keys, candidate order, media lists) are written out by
 * hand from the spec's normative schema and `diff-plan.ts`'s own doc
 * comments — never produced by calling `buildDiffPlan` itself and asserting
 * it equals its own output.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  buildDiffPlan,
  diffCandidates,
  computeStaleness,
  loadProject,
  DIFF_PLAN_VERSION,
  OLD_RENDER_OUTPUT_DIR,
  type DiffPlan,
} from '../src/index.js';
import type { ProjectModel } from '../src/load.js';
import type { Component } from '../src/schemas.js';
import type { StalenessReport } from '../src/staleness.js';

const fixturesDir = join(import.meta.dirname, '../fixtures');

// ---------------------------------------------------------------------------
// Helpers to hand-build a minimal ProjectModel/StalenessReport pair without
// going through loadProject/computeStaleness (buildDiffPlan only reads
// `model.components`, so the rest of ProjectModel is stubbed).
// ---------------------------------------------------------------------------

function minimalComponent(overrides: Partial<Component> & { id: string; design_version: string }): Component {
  return {
    id: overrides.id,
    name: overrides.id,
    kind: 'printed',
    design_version: overrides.design_version,
    master_format: 'none',
    source_files: [],
    derived_files: [],
    ...overrides,
  } as Component;
}

function modelWith(components: Component[]): ProjectModel {
  return {
    config: {} as ProjectModel['config'],
    components: new Map(components.map((c) => [c.id, c])),
    steps: new Map(),
    media: new Map(),
    problems: [],
  };
}

// ---------------------------------------------------------------------------
// AC1: diffCandidates — glb-first, then stl, other extensions dropped, order
// within each group preserved.
// ---------------------------------------------------------------------------

describe('AC1: diffCandidates', () => {
  it('orders .glb before .stl and drops other extensions, preserving original order within each group', () => {
    const derived = [
      'Parts/Foo.step',
      'Parts/Foo.stl',
      'Parts/Foo.GLB',
      'Parts/Bar.stl',
      'Parts/Bar.glb',
      'Parts/readme.md',
    ];
    expect(diffCandidates(derived)).toEqual(['Parts/Foo.GLB', 'Parts/Bar.glb', 'Parts/Foo.stl', 'Parts/Bar.stl']);
  });

  it('returns [] for an empty list', () => {
    expect(diffCandidates([])).toEqual([]);
  });

  it('returns [] when nothing matches .glb or .stl', () => {
    expect(diffCandidates(['a.step', 'b.f3z', 'c.scad'])).toEqual([]);
  });

  it('a single .stl with no .glb candidates yields just the .stl', () => {
    expect(diffCandidates(['Parts/only.stl'])).toEqual(['Parts/only.stl']);
  });
});

// ---------------------------------------------------------------------------
// AC1: buildDiffPlan — hand-built model/staleness, asserted against a
// hand-written expected plan literal.
// ---------------------------------------------------------------------------

describe('AC1: buildDiffPlan (hand-built model)', () => {
  const topStop = minimalComponent({
    id: 'top-stop',
    design_version: '2.0.0',
    master_format: 'scad',
    source_files: ['Components/TopStop/TopStop.scad'],
    derived_files: ['docs/a.step', 'docs/a.stl', 'docs/a.glb'],
  });
  const anodeMmo = minimalComponent({ id: 'anode-mmo', design_version: '1.0.0', master_format: 'none' });
  // 'ghost-part' is deliberately absent from the model's components map, to
  // exercise a hero pin whose component cannot be resolved.
  const model = modelWith([topStop, anodeMmo]);

  const staleness: StalenessReport = {
    'media-1': {
      type: 'video',
      status: 'STALE',
      shot_date: '2026-01-01',
      stale_heroes: [
        { component: 'top-stop', shot_with: '1.0.0', current: '2.0.0', changelog: [] },
        { component: 'anode-mmo', shot_with: '0.9.0', current: '1.0.0', changelog: [] },
      ],
      changed_in_frame: [],
    },
    'media-2': {
      type: 'photo',
      status: 'STALE',
      shot_date: '2026-01-02',
      stale_heroes: [
        { component: 'top-stop', shot_with: '1.0.0', current: '2.0.0', changelog: [] },
        { component: 'ghost-part', shot_with: '3.0.0', current: '4.0.0', changelog: [] },
      ],
      changed_in_frame: [],
    },
    'media-3': {
      type: 'video',
      status: 'CHANGED_IN_FRAME',
      shot_date: '2026-01-03',
      stale_heroes: [],
      changed_in_frame: [{ component: 'top-stop', shot_with: '1.5.0', current: '2.0.0', changelog: [] }],
    },
    'media-4': {
      type: 'photo',
      status: 'FRESH',
      shot_date: '2026-01-04',
      stale_heroes: [],
      changed_in_frame: [],
    },
  };

  const expected: DiffPlan = {
    version: 1,
    jobs: [
      {
        key: 'anode-mmo@0.9.0',
        component: 'anode-mmo',
        version: '0.9.0',
        current: '1.0.0',
        component_file: 'docs/components/anode-mmo.yaml',
        candidates: [],
        output: 'build/render/old/anode-mmo@0.9.0.glb',
        media: ['media-1'],
      },
      {
        key: 'ghost-part@3.0.0',
        component: 'ghost-part',
        version: '3.0.0',
        current: '4.0.0',
        component_file: 'docs/components/ghost-part.yaml',
        candidates: [],
        output: 'build/render/old/ghost-part@3.0.0.glb',
        media: ['media-2'],
      },
      {
        key: 'top-stop@1.0.0',
        component: 'top-stop',
        version: '1.0.0',
        current: '2.0.0',
        component_file: 'docs/components/top-stop.yaml',
        candidates: ['docs/a.glb', 'docs/a.stl'],
        output: 'build/render/old/top-stop@1.0.0.glb',
        media: ['media-1', 'media-2'],
      },
    ],
  };

  it('yields exactly the expected schema, deduplicated, sorted by key, candidates glb-first', () => {
    expect(buildDiffPlan(model, staleness)).toEqual(expected);
  });

  it('never mutates model or staleness', () => {
    const modelSnapshot = JSON.stringify([...model.components.entries()]);
    const stalenessSnapshot = JSON.stringify(staleness);
    buildDiffPlan(model, staleness);
    expect(JSON.stringify([...model.components.entries()])).toEqual(modelSnapshot);
    expect(JSON.stringify(staleness)).toEqual(stalenessSnapshot);
  });

  it('OLD_RENDER_OUTPUT_DIR is "build/render/old" and every job output lives under it', () => {
    expect(OLD_RENDER_OUTPUT_DIR).toBe('build/render/old');
    const plan = buildDiffPlan(model, staleness);
    for (const job of plan.jobs) {
      expect(job.output).toBe(`${OLD_RENDER_OUTPUT_DIR}/${job.key}.glb`);
    }
  });

  it('DIFF_PLAN_VERSION is 1 and matches plan.version', () => {
    expect(DIFF_PLAN_VERSION).toBe(1);
    expect(buildDiffPlan(model, staleness).version).toBe(1);
  });
});

describe('AC1: buildDiffPlan excludes non-STALE statuses entirely', () => {
  it('a model with only CHANGED_IN_FRAME and FRESH media yields no jobs', () => {
    const model = modelWith([minimalComponent({ id: 'x', design_version: '2.0.0' })]);
    const staleness: StalenessReport = {
      m1: {
        type: 'photo',
        status: 'CHANGED_IN_FRAME',
        shot_date: '2026-01-01',
        stale_heroes: [],
        changed_in_frame: [{ component: 'x', shot_with: '1.0.0', current: '2.0.0', changelog: [] }],
      },
      m2: { type: 'photo', status: 'FRESH', shot_date: '2026-01-01', stale_heroes: [], changed_in_frame: [] },
    };
    expect(buildDiffPlan(model, staleness)).toEqual({ version: 1, jobs: [] });
  });
});

// ---------------------------------------------------------------------------
// AC1: exported from the package entry (`@docsandeye/core`'s index.ts).
// ---------------------------------------------------------------------------

describe('AC1: exported from package entry', () => {
  it('exports buildDiffPlan, diffCandidates, DIFF_PLAN_VERSION, OLD_RENDER_OUTPUT_DIR', () => {
    expect(typeof buildDiffPlan).toBe('function');
    expect(typeof diffCandidates).toBe('function');
    expect(DIFF_PLAN_VERSION).toBe(1);
    expect(typeof OLD_RENDER_OUTPUT_DIR).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// AC1: the aep-like fixture yields exactly the distinct STALE hero pairs.
// ---------------------------------------------------------------------------

describe('AC1: aep-like fixture', () => {
  it('yields exactly one job: electrode-top-stop@1.3.0, pinned by vid-005-electrode-seating', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const plan = buildDiffPlan(model, staleness);
    expect(plan).toEqual({
      version: 1,
      jobs: [
        {
          key: 'electrode-top-stop@1.3.0',
          component: 'electrode-top-stop',
          version: '1.3.0',
          current: '2.0.0',
          component_file: 'docs/components/electrode-top-stop.yaml',
          candidates: [],
          output: 'build/render/old/electrode-top-stop@1.3.0.glb',
          media: ['vid-005-electrode-seating'],
        },
      ],
    });
  });
});
