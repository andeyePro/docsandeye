/**
 * Render plan (`build/render-plan.json`) consumed by the Python render pipeline.
 * One job per distinct key; keys are content-addressed over `{parameters, options}`.
 *
 * Hand-exported components (`master_format` `f3z` or `none`) are the exception.
 * Their outputs are the component's `derived_files`, which do not vary with the
 * render id or the render options, so a component referenced by both a step
 * render and a viewer would otherwise yield several jobs asking the pipeline to
 * produce byte-identical output. The plan therefore emits ONE hand-exported job
 * per distinct `outputs` list — de-duplicated on the first output path, keeping
 * the job whose key sorts first (the one that leads the plan's own ordering).
 * The survivor keeps the ordinary `<component>@<version>--<render_id>--<hash>`
 * key format; nothing about the key changes. A hand-exported component with no
 * `derived_files` at all has no output path to key on and is left alone.
 */
import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.js';
import type { ProjectModel } from './load.js';
import type { Component, MasterFormat, ParameterValue, RenderFormat, RenderView } from './schemas.js';

export const RENDER_PLAN_VERSION = 1 as const;
export const RENDER_OUTPUT_DIR = 'build/render';

export interface RenderJobOptions {
  annotate?: boolean;
  explode?: boolean;
  format: RenderFormat;
  view?: RenderView;
}

export interface RenderJob {
  key: string;
  component: string;
  design_version: string;
  render_id: string;
  master_format: MasterFormat;
  source_files: string[];
  parameters: Record<string, ParameterValue>;
  options: RenderJobOptions;
  outputs: string[];
  /** Present only for `f3z`/`none` masters, whose outputs are the component's `derived_files`. */
  status?: 'hand-exported';
}

export interface RenderPlan {
  version: typeof RENDER_PLAN_VERSION;
  project_root: string;
  jobs: RenderJob[];
}

/** First 12 lowercase hex chars of SHA-256 over compact canonical JSON of `{parameters, options}`. */
export function renderParamsHash(parameters: Record<string, ParameterValue>, options: RenderJobOptions): string {
  const canonical = canonicalJson({ parameters, options }, { compact: true });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

export function renderJobKey(component: Component, renderId: string, options: RenderJobOptions): string {
  const parameters = component.parameters ?? {};
  return `${component.id}@${component.design_version}--${renderId}--${renderParamsHash(parameters, options)}`;
}

export function buildRenderPlan(model: ProjectModel): RenderPlan {
  const jobs = new Map<string, RenderJob>();
  const stepIds = [...model.steps.keys()].sort();

  for (const stepId of stepIds) {
    const step = model.steps.get(stepId)!;
    for (const render of step.renders) {
      const component = model.components.get(render.component);
      if (!component) continue; // reported by loadProject
      const options: RenderJobOptions = { annotate: render.annotate, explode: render.explode, format: render.format, view: render.view };
      addJob(jobs, component, render.id, options);
    }
    if (step.viewer) {
      const component = model.components.get(step.viewer.component);
      if (component) addJob(jobs, component, 'viewer', { format: step.viewer.format });
    }
  }

  const sorted = [...dedupeHandExported(jobs.values())].sort((a, b) =>
    a.component !== b.component ? cmp(a.component, b.component) : a.render_id !== b.render_id ? cmp(a.render_id, b.render_id) : cmp(a.key, b.key),
  );
  return { version: RENDER_PLAN_VERSION, project_root: '.', jobs: sorted };
}

/**
 * Collapse hand-exported jobs that would write the same files: at most one job
 * per first output path, the one whose key sorts first. Jobs that render (and
 * hand-exported jobs with no outputs at all) pass through untouched.
 */
function dedupeHandExported(jobs: Iterable<RenderJob>): RenderJob[] {
  const kept: RenderJob[] = [];
  const byOutput = new Map<string, number>();
  for (const job of jobs) {
    const output = job.status === 'hand-exported' ? job.outputs[0] : undefined;
    if (output === undefined) {
      kept.push(job);
      continue;
    }
    const seen = byOutput.get(output);
    if (seen === undefined) {
      byOutput.set(output, kept.push(job) - 1);
      continue;
    }
    if (cmp(job.key, kept[seen]!.key) < 0) kept[seen] = job;
  }
  return kept;
}

function addJob(jobs: Map<string, RenderJob>, component: Component, renderId: string, options: RenderJobOptions): void {
  const parameters = structuredClone(component.parameters ?? {});
  const key = renderJobKey(component, renderId, options);
  if (jobs.has(key)) return;
  const handExported = component.master_format === 'f3z' || component.master_format === 'none';
  const job: RenderJob = {
    key,
    component: component.id,
    design_version: component.design_version,
    render_id: renderId,
    master_format: component.master_format,
    source_files: [...component.source_files],
    parameters,
    options: sortedOptions(options),
    outputs: handExported ? [...component.derived_files] : [`${RENDER_OUTPUT_DIR}/${key}.${options.format}`],
  };
  if (handExported) job.status = 'hand-exported';
  jobs.set(key, job);
}

/** Emit option keys in alphabetical order, matching `canonicalJson`. */
function sortedOptions(options: RenderJobOptions): RenderJobOptions {
  const entries = Object.entries(options)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => cmp(a, b));
  return Object.fromEntries(entries) as RenderJobOptions;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
