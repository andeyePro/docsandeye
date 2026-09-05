/**
 * Build-time data loading: the project model (via core), the staleness
 * report, the render manifest written by the render pipeline, the media
 * manifest written by the encode pipeline, and the carbon report written by
 * the CLI. Everything the pages need is computed
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

export type MediaJobStatus = 'encoded' | 'cached' | 'skipped' | 'failed';

/** One entry of `build/media/manifest.json` (the encode pipeline's output). */
export interface MediaManifestJob {
  status: MediaJobStatus;
  driver: string;
  /** Output name (`av1_720`, `h264_720`, `av1_1080`, `h264_1080`, `poster`, `captions`) → project-relative path. */
  outputs: Record<string, string>;
  /** Informational: renditions taller than the source. Key presence in `outputs` is the source of truth. */
  skipped_renditions?: number[];
  poster_mode?: string;
  encoded_at?: string;
  reason?: string;
  source_stat?: { size: number; mtime_ns: number };
  source_probe?: { width: number; height: number; duration_s: number };
}

export interface MediaManifest {
  version: 1;
  jobs: Record<string, MediaManifestJob>;
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
  /** `null` when the project has no `build/media/manifest.json` (videos then degrade to the authored original). */
  mediaManifest: MediaManifest | null;
  /** `null` when the project has no `build/carbon.json`. */
  carbon: CarbonReport | null;
  /** ISO date `YYYY-MM-DD` used as the "updated within 30 days" reference. */
  buildDate: string;
  maintainer: boolean;
}

export const RENDER_MANIFEST_PATH = 'build/render/manifest.json';
export const MEDIA_MANIFEST_PATH = 'build/media/manifest.json';
export const CARBON_PATH = 'build/carbon.json';

/** Job statuses whose outputs are on disk and may be offered to the page. */
export const OFFERED_STATUSES: ReadonlySet<string> = new Set<MediaJobStatus>(['encoded', 'cached']);

const RENDITION_KEY_RE = /^av1_(\d+)$/;

/**
 * Rendition heights a video job offers, ascending: `h` is offered iff the job
 * is `encoded|cached` and both `outputs.av1_<h>` and `outputs.h264_<h>` exist.
 */
export function offeredRenditions(job: Pick<MediaManifestJob, 'status' | 'outputs'>): number[] {
  if (!OFFERED_STATUSES.has(job.status)) return [];
  const heights: number[] = [];
  for (const key of Object.keys(job.outputs)) {
    const match = RENDITION_KEY_RE.exec(key);
    if (!match) continue;
    const height = Number(match[1]);
    if (job.outputs[`h264_${height}`] !== undefined) heights.push(height);
  }
  return heights.sort((a, b) => a - b);
}

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
    mediaManifest: readMediaManifest(root),
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

/** Absent → `null` (degraded mode); present but malformed → throw, like the render manifest. */
function readMediaManifest(root: string): MediaManifest | null {
  const file = path.join(root, MEDIA_MANIFEST_PATH);
  if (!fs.existsSync(file)) return null;
  const raw = readJson(file);
  if (!isRecord(raw) || !isRecord(raw.jobs)) {
    throw new Error(`starlight-docsandeye: ${file} must be an object with a "jobs" object`);
  }
  if (raw.version !== undefined && raw.version !== 1) {
    throw new Error(`starlight-docsandeye: ${file}: unsupported media manifest version ${String(raw.version)} (expected 1)`);
  }
  const jobs: Record<string, MediaManifestJob> = {};
  for (const [key, job] of Object.entries(raw.jobs)) {
    if (!isRecord(job) || typeof job.status !== 'string') {
      throw new Error(`starlight-docsandeye: ${file}: job "${key}" must have a string "status"`);
    }
    if (!isRecord(job.outputs) || !Object.values(job.outputs).every((o) => typeof o === 'string')) {
      throw new Error(`starlight-docsandeye: ${file}: job "${key}" must have an "outputs" object of string paths`);
    }
    const entry: MediaManifestJob = {
      ...job,
      status: job.status as MediaJobStatus,
      driver: typeof job.driver === 'string' ? job.driver : 'unknown',
      outputs: job.outputs as Record<string, string>,
    };
    if (Array.isArray(job.skipped_renditions)) {
      entry.skipped_renditions = job.skipped_renditions.filter((h): h is number => typeof h === 'number');
    } else {
      delete entry.skipped_renditions;
    }
    jobs[key] = entry;
  }
  return { version: 1, jobs };
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
