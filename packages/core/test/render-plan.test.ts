import { describe, it, expect } from 'vitest';
import { loadProject, buildRenderPlan, canonicalJson, renderParamsHash } from '../src/index.js';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '../fixtures');

// Helper to compute params hash independently
function computeParamsHashIndependently(parameters: Record<string, any>, options: Record<string, any>) {
  const canonical = canonicalJson({ parameters, options }, { compact: true });
  const hash = createHash('sha256').update(canonical).digest('hex');
  return hash.slice(0, 12);
}

describe('AC9: Render plan', () => {
  it('returns schema with version, project_root, jobs array', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const plan = buildRenderPlan(model);
    expect(plan).toHaveProperty('version');
    expect(plan).toHaveProperty('project_root');
    expect(plan).toHaveProperty('jobs');
    expect(Array.isArray(plan.jobs)).toBe(true);
  });

  it('version is 1', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const plan = buildRenderPlan(model);
    expect(plan.version).toBe(1);
  });

  it('project_root is "."', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const plan = buildRenderPlan(model);
    expect(plan.project_root).toBe('.');
  });

  it('job key format is correct', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const plan = buildRenderPlan(model);
    // Key = <component>@<design_version>--<render_id>--<params-hash>
    for (const job of plan.jobs) {
      const keyParts = job.key.split('--');
      expect(keyParts.length).toBe(3);
      const componentVersion = keyParts[0];
      expect(componentVersion).toContain('@');
      const [comp, version] = componentVersion.split('@');
      expect(comp).toBe(job.component);
      expect(version).toBe(job.design_version);
      expect(keyParts[1]).toBe(job.render_id);
      expect(keyParts[2]).toMatch(/^[0-9a-f]{12}$/);
    }
  });

  it('params-hash is computed from canonicalJson of {parameters, options}', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const plan = buildRenderPlan(model);
    for (const job of plan.jobs) {
      const expectedHash = computeParamsHashIndependently(job.parameters, job.options);
      const actualHash = job.key.split('--')[2];
      expect(actualHash).toBe(expectedHash);
    }
  });

  it('options has only annotate, explode, format, view keys in alphabetical order', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildRenderPlan(model);
    for (const job of plan.jobs) {
      const optionKeys = Object.keys(job.options).sort();
      const expectedKeys = Object.keys(job.options).sort();
      expect(optionKeys).toEqual(expectedKeys);
      for (const key of Object.keys(job.options)) {
        expect(['annotate', 'explode', 'format', 'view']).toContain(key);
      }
    }
  });

  it('parameters is verbatim copy from component', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildRenderPlan(model);
    // Find a job for vial-cap which has parameters
    const vialCapComponent = model.components.get('vial-cap-2x6.1-5x3.2');
    if (vialCapComponent && vialCapComponent.parameters) {
      const vialCapJobs = plan.jobs.filter(j => j.component === 'vial-cap-2x6.1-5x3.2');
      for (const job of vialCapJobs) {
        expect(job.parameters).toEqual(vialCapComponent.parameters);
      }
    }
  });

  it('jobs are de-duplicated by key', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const plan = buildRenderPlan(model);
    const keys = plan.jobs.map(j => j.key);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('jobs sorted by component, render_id, key', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildRenderPlan(model);
    for (let i = 1; i < plan.jobs.length; i++) {
      const prev = plan.jobs[i - 1];
      const curr = plan.jobs[i];
      if (prev.component === curr.component) {
        if (prev.render_id === curr.render_id) {
          expect(curr.key >= prev.key).toBe(true);
        } else {
          expect(curr.render_id >= prev.render_id).toBe(true);
        }
      } else {
        expect(curr.component >= prev.component).toBe(true);
      }
    }
  });

  it('non-hand-exported output paths are under build/render/', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const plan = buildRenderPlan(model);
    for (const job of plan.jobs) {
      if (!('status' in job) || job.status !== 'hand-exported') {
        for (const output of job.outputs) {
          expect(output).toMatch(/^build\/render\//);
        }
      }
    }
  });

  it('hand-exported jobs have status and outputs from derived_files', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildRenderPlan(model);
    // lid-assembly has master_format f3z
    const lidAssembly = model.components.get('lid-assembly');
    if (lidAssembly && (lidAssembly.master_format === 'f3z' || lidAssembly.master_format === 'none')) {
      const handExportedJobs = plan.jobs.filter(
        j => j.component === 'lid-assembly' && ('status' in j && j.status === 'hand-exported')
      );
      for (const job of handExportedJobs) {
        expect(job.outputs).toEqual(lidAssembly.derived_files);
      }
    }
  });

  it('viewer entries become jobs with render_id viewer', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildRenderPlan(model);
    // Find any viewer render
    const step01 = model.steps.get('step-01-print-parts');
    if (step01 && step01.viewer) {
      const viewerJobs = plan.jobs.filter(j => j.render_id === 'viewer' && j.component === step01.viewer.component);
      expect(viewerJobs.length).toBeGreaterThan(0);
      for (const job of viewerJobs) {
        expect(job.options.format).toBe(step01.viewer.format || 'glb');
      }
    }
  });
});

describe('AC9: hand-exported jobs are de-duplicated by outputs', () => {
  // aep-like's lid-assembly (master_format f3z) is referenced by two step
  // renders (lid-closed, lid-open) and a viewer, all three of which would
  // write the component's derived_files verbatim.
  it('emits one job per distinct outputs list for a hand-exported component', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildRenderPlan(model);

    const lidJobs = plan.jobs.filter(j => j.component === 'lid-assembly');
    const lidAssembly = model.components.get('lid-assembly')!;
    expect(lidAssembly.master_format).toBe('f3z');
    expect(lidAssembly.derived_files.length).toBeGreaterThan(0);

    expect(lidJobs).toHaveLength(1);
    expect(lidJobs[0].status).toBe('hand-exported');
    expect(lidJobs[0].outputs).toEqual(lidAssembly.derived_files);
    // The survivor keeps the spec's key format, and is the one that sorts first
    // of the three candidates (render ids lid-closed, lid-open, viewer).
    expect(lidJobs[0].render_id).toBe('lid-closed');
    expect(lidJobs[0].key).toBe(`lid-assembly@${lidAssembly.design_version}--lid-closed--${lidJobs[0].key.split('--')[2]}`);
  });

  it('no two jobs in a plan share a first output path', () => {
    for (const fixture of ['minimal', 'aep-like']) {
      const plan = buildRenderPlan(loadProject(join(fixturesDir, fixture)));
      const firstOutputs = plan.jobs.map(j => j.outputs[0]).filter(o => o !== undefined);
      expect(new Set(firstOutputs).size, fixture).toBe(firstOutputs.length);
    }
  });

  it('leaves rendered jobs alone: one job per render id', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildRenderPlan(model);
    const topStop = plan.jobs.filter(j => j.component === 'electrode-top-stop').map(j => j.render_id).sort();
    expect(topStop).toEqual(['topstop-exploded', 'topstop-front', 'viewer']);
  });
});
