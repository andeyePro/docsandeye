/**
 * Build-time data loading: the project model (via core), the staleness
 * report, the render manifest written by the render pipeline, and the
 * carbon report written by the CLI. Everything the pages need is computed
 * once here and served to the Astro build through `virtual:docsandeye/model`.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  DocsiError,
  computeStaleness,
  loadProject,
  type Config,
  type ProjectModel,
  type StalenessReport,
} from '@docsandeye/core';

/** One entry of `build/render/manifest.json` (the render pipeline's output; not core's render plan). */
export interface RenderManifestJob {
  status: string;
  driver?: string;
  /** Project-relative output paths, e.g. `build/render/<key>.png`. */
  outputs: string[];
  rendered_at?: string;
  [key: string]: unknown;
}

export interface RenderManifest {
  version: number;
  jobs: Record<string, RenderManifestJob>;
}

export interface CarbonPage {
  bytes: number;
  gco2e: number;
}

/** `build/carbon.json`: keys are site-relative URL paths with leading and trailing slash. */
export interface CarbonReport {
  version: number;
  pages: Record<string, CarbonPage>;
}

export type DocsandeyeEnv = Record<string, string | undefined>;

export interface DocsandeyeData {
  config: Config;
  model: ProjectModel;
  staleness: StalenessReport;
  /** `null` when the project has no `build/render/manifest.json`. */
  renderManifest: RenderManifest | null;
  /** `null` when the project has no `build/carbon.json`. */
  carbon: CarbonReport | null;
  /** ISO date `YYYY-MM-DD` used as the "updated within 30 days" reference. */
  buildDate: string;
  maintainer: boolean;
}

export const RENDER_MANIFEST_PATH = 'build/render/manifest.json';
export const CARBON_PATH = 'build/carbon.json';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Load everything the plugin needs from `projectRoot`.
 *
 * `env.DOCSANDEYE_BUILD_DATE` (ISO date, default today) fixes the staleness
 * reference date; `env.DOCSANDEYE_MAINTAINER=1` enables maintainer output.
 * Throws when the project has validation problems, so a broken tree never
 * silently produces broken pages.
 */
export function loadDocsandeyeData(projectRoot: string, env: DocsandeyeEnv = process.env): DocsandeyeData {
  const root = path.resolve(projectRoot);
  const model = loadProject(root);
  if (model.problems.length > 0) {
    throw new DocsiError(model.problems, `starlight-docsandeye: ${model.problems.length} problem(s) in ${root}:\n${formatProblems(model)}`);
  }
  return {
    config: model.config,
    model,
    staleness: computeStaleness(model),
    renderManifest: readRenderManifest(root),
    carbon: readCarbon(root),
    buildDate: resolveBuildDate(env.DOCSANDEYE_BUILD_DATE),
    maintainer: isMaintainer(env.DOCSANDEYE_MAINTAINER),
  };
}

export function isMaintainer(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

export function resolveBuildDate(value: string | undefined): string {
  if (value === undefined || value === '') return new Date().toISOString().slice(0, 10);
  if (!ISO_DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`starlight-docsandeye: DOCSANDEYE_BUILD_DATE must be an ISO date YYYY-MM-DD, got "${value}"`);
  }
  return value;
}

function formatProblems(model: ProjectModel): string {
  return model.problems.map((p) => `  ${p.file}${p.path ? `:${p.path}` : ''} [${p.code}] ${p.message}`).join('\n');
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`starlight-docsandeye: cannot parse ${file}: ${(err as Error).message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRenderManifest(root: string): RenderManifest | null {
  const file = path.join(root, RENDER_MANIFEST_PATH);
  if (!fs.existsSync(file)) return null;
  const raw = readJson(file);
  if (!isRecord(raw) || !isRecord(raw.jobs)) {
    throw new Error(`starlight-docsandeye: ${file} must be an object with a "jobs" object`);
  }
  const jobs: Record<string, RenderManifestJob> = {};
  for (const [key, job] of Object.entries(raw.jobs)) {
    if (!isRecord(job) || !Array.isArray(job.outputs) || !job.outputs.every((o) => typeof o === 'string')) {
      throw new Error(`starlight-docsandeye: ${file}: job "${key}" must have an "outputs" string array`);
    }
    jobs[key] = { ...job, status: typeof job.status === 'string' ? job.status : 'unknown', outputs: job.outputs as string[] };
  }
  return { version: typeof raw.version === 'number' ? raw.version : 1, jobs };
}

function readCarbon(root: string): CarbonReport | null {
  const file = path.join(root, CARBON_PATH);
  if (!fs.existsSync(file)) return null;
  const raw = readJson(file);
  if (!isRecord(raw) || !isRecord(raw.pages)) {
    throw new Error(`starlight-docsandeye: ${file} must be an object with a "pages" object`);
  }
  const pages: Record<string, CarbonPage> = {};
  for (const [key, page] of Object.entries(raw.pages)) {
    if (!isRecord(page) || typeof page.bytes !== 'number' || typeof page.gco2e !== 'number') {
      throw new Error(`starlight-docsandeye: ${file}: page "${key}" must have numeric "bytes" and "gco2e"`);
    }
    pages[key] = { bytes: page.bytes, gco2e: page.gco2e };
  }
  return { version: typeof raw.version === 'number' ? raw.version : 1, pages };
}
