/**
 * `docsandeye diff`: restore each STALE hero component's derived geometry as
 * it was at the recorded version, from git history, and convert it to GLB so
 * the plugin can show old and new side by side.
 *
 * Core plans the work (`build/diff-plan.json`, one job per distinct
 * `<component>@<version>`); this module owns git and process spawning and
 * writes `build/render/old/manifest.json`. Old geometry comes from git only,
 * never from a separate archive, and the outputs are cached by key.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildDiffPlan, canonicalJson, computeStaleness, type DiffJob } from '@docsandeye/core';
import { componentFile } from './check.js';
import { EXIT, formatProblem, loadProjectSafely, type Io } from './common.js';
import { existsAt, isInsideWorkTree, lastCommitMatching, revParse, showFileAt } from './git.js';
import { spawnPython } from './render.js';

export const DIFF_PLAN_PATH = 'build/diff-plan.json';
export const OLD_RENDER_DIR = 'build/render/old';
export const OLD_MANIFEST_PATH = `${OLD_RENDER_DIR}/manifest.json`;

export const REASON_NOT_GIT = 'not a git repository';
export const REASON_NO_CANDIDATE = 'no derived .glb or .stl';

export type OldJobStatus = 'restored' | 'cached' | 'skipped' | 'failed';

export interface OldManifestJob {
  status: OldJobStatus;
  /** Commit the geometry was taken from (absent when no commit was found). */
  commit?: string;
  /** The derived file restored (a candidate path from the plan). */
  source?: string;
  /** Project-relative `.glb` path, present for every status. */
  output: string;
  reason?: string;
}

export interface OldManifest {
  version: 1;
  jobs: Record<string, OldManifestJob>;
}

export interface DiffOptions {
  root: string;
  force: boolean;
}

export interface DiffCounts {
  restored: number;
  cached: number;
  skipped: number;
  failed: number;
}

export function noCommitReason(version: string): string {
  return `no commit with design_version ${version}`;
}

/** `-G` pattern: the bare unquoted `design_version:` line core's fixtures and the `init` template write. */
export function designVersionPattern(version: string): string {
  return `^design_version: ${version}$`;
}

/** argv handed to `python3` (after the program name) to convert one restored STL. */
export function glbArgs(stl: string, output: string): string[] {
  return ['-m', 'docsandeye_render', 'glb', stl, output];
}

export function summaryLine(counts: DiffCounts): string {
  return `restored ${counts.restored}, cached ${counts.cached}, skipped ${counts.skipped}, failed ${counts.failed}`;
}

/**
 * The commit that last carried `design_version: <version>` in `file`:
 * `git log -1 -G` finds the commit that changed away from (or introduced) the
 * line; its parent is preferred when the parent still holds the version, else
 * the commit itself. A parent that cannot be shown (root commit) counts as not
 * containing it.
 */
export async function resolveOldCommit(root: string, file: string, version: string): Promise<string | undefined> {
  const sha = await lastCommitMatching(root, file, designVersionPattern(version));
  if (sha === undefined) return undefined;
  const needle = `design_version: ${version}`;
  const parent = await showFileAt(root, `${sha}^`, file);
  if (parent !== undefined && parent.toString('utf8').includes(needle)) return `${sha}^`;
  const own = await showFileAt(root, sha, file);
  return own !== undefined && own.toString('utf8').includes(needle) ? sha : undefined;
}

/** Previous manifest for the cache check; anything unreadable counts as no cache. */
export function readOldManifest(root: string): OldManifest | undefined {
  const file = path.join(root, OLD_MANIFEST_PATH);
  if (!fs.existsSync(file)) return undefined;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { jobs?: unknown };
    if (typeof raw !== 'object' || raw === null || typeof raw.jobs !== 'object' || raw.jobs === null) return undefined;
    return { version: 1, jobs: raw.jobs as Record<string, OldManifestJob> };
  } catch {
    return undefined;
  }
}

/** Sorted keys at every depth, 2-space indent, trailing newline. */
export function formatOldManifest(manifest: OldManifest): string {
  return `${canonicalJson(manifest)}\n`;
}

export async function runDiff(opts: DiffOptions, io: Io): Promise<number> {
  const { model, problems } = loadProjectSafely(opts.root);
  if (problems.length > 0 || !model) {
    for (const p of problems) io.err(formatProblem(p));
    return EXIT.PROBLEMS;
  }

  const plan = buildDiffPlan(model, computeStaleness(model));
  const planPath = path.join(opts.root, DIFF_PLAN_PATH);
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, `${canonicalJson(plan)}\n`);
  fs.mkdirSync(path.join(opts.root, OLD_RENDER_DIR), { recursive: true });

  const previous = readOldManifest(opts.root);
  const inGit = await isInsideWorkTree(opts.root);
  const manifest: OldManifest = { version: 1, jobs: {} };
  const counts: DiffCounts = { restored: 0, cached: 0, skipped: 0, failed: 0 };

  for (const job of plan.jobs) {
    const entry = inGit ? await restoreJob(opts, job, previous?.jobs[job.key], io) : { status: 'skipped' as const, output: job.output, reason: REASON_NOT_GIT };
    manifest.jobs[job.key] = entry;
    counts[entry.status] += 1;
    if (entry.reason !== undefined) io.err(`${job.key}: ${entry.reason}`);
  }

  fs.writeFileSync(path.join(opts.root, OLD_MANIFEST_PATH), formatOldManifest(manifest));
  io.out(summaryLine(counts));
  return counts.failed > 0 ? EXIT.PROBLEMS : EXIT.OK;
}

async function restoreJob(opts: DiffOptions, job: DiffJob, previous: OldManifestJob | undefined, io: Io): Promise<OldManifestJob> {
  const { root } = opts;
  const output = job.output;
  if (job.candidates.length === 0) return { status: 'skipped', output, reason: REASON_NO_CANDIDATE };

  const planned = job.component_file;
  const file = fs.existsSync(path.join(root, planned)) ? planned : componentFile(root, job.component);
  const ref = await resolveOldCommit(root, file, job.version);
  if (ref === undefined) return { status: 'skipped', output, reason: noCommitReason(job.version) };
  const commit = (await revParse(root, ref)) ?? ref;

  let source: string | undefined;
  for (const candidate of job.candidates) {
    if (await existsAt(root, commit, candidate)) {
      source = candidate;
      break;
    }
  }
  if (source === undefined) return { status: 'skipped', output, reason: `no derived file committed at ${commit.slice(0, 7)}` };

  const outputAbs = path.join(root, output);
  if (!opts.force && fs.existsSync(outputAbs) && previous?.commit === commit && (previous.status === 'restored' || previous.status === 'cached')) {
    return { status: 'cached', commit, source, output };
  }

  const bytes = await showFileAt(root, commit, source);
  if (bytes === undefined) return { status: 'failed', commit, source, output, reason: `git show failed for ${commit.slice(0, 7)}:${source}` };

  const ext = source.slice(source.lastIndexOf('.') + 1).toLowerCase();
  const restored = ext === 'glb' ? output : `${OLD_RENDER_DIR}/${job.key}.${ext}`;
  fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
  fs.writeFileSync(path.join(root, restored), bytes);
  if (ext === 'glb') return { status: 'restored', commit, source, output };

  const code = await spawnPython(glbArgs(restored, output), root, io);
  if (code !== 0) return { status: 'failed', commit, source, output, reason: `python3 exited ${code}` };
  return { status: 'restored', commit, source, output };
}
