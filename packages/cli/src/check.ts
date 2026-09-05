/**
 * `docsandeye check`: content validation, the version-bump guard against
 * real git history, and (with `--dist`) the per-page byte budget plus the
 * CO2.js estimate written to `build/carbon.json`. Since v0.2 an over-budget
 * page is an error by default (`--no-strict` demotes it to a warning).
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, checkVersionBumps, type ProjectModel, type VersionBumpFacts } from '@docsandeye/core';
import { analyseDist, carbonDocument } from './budget.js';
import { EXIT, formatProblem, loadProjectSafely, type Io } from './common.js';
import { isAncestor, isInsideWorkTree, lastCommitTouching, lastDesignVersionChange } from './git.js';

export const CARBON_PATH = 'build/carbon.json';
export const DEFAULT_BUDGET_KB = 150;

export interface CheckOptions {
  root: string;
  /** Built site directory; budget and carbon steps run only when set. */
  dist?: string;
  /** v0.2 default: over-budget pages are errors. `--no-strict` keeps them as warnings. */
  strict: boolean;
}

/** The one warning class strict mode promotes: `budget: <page> <kb> KB > <limit> KB`. */
export const OVER_BUDGET_RE = /^budget: .* \d+ KB > \d+ KB$/;

export function isOverBudgetLine(line: string): boolean {
  return OVER_BUDGET_RE.test(line);
}

export interface GuardReport {
  errors: string[];
  warnings: string[];
}

/** Repo-relative path of a component's YAML file (`.yaml` preferred, `.yml` when that is what exists). */
export function componentFile(root: string, id: string): string {
  const yaml = `docs/components/${id}.yaml`;
  if (fs.existsSync(path.join(root, yaml))) return yaml;
  const yml = `docs/components/${id}.yml`;
  return fs.existsSync(path.join(root, yml)) ? yml : yaml;
}

/** Gather git facts for every component with source files, then run core's guard. */
export async function runGuard(root: string, model: ProjectModel): Promise<GuardReport> {
  const report: GuardReport = { errors: [], warnings: [] };
  if (!(await isInsideWorkTree(root))) {
    report.warnings.push('guard: not a git repository, version-bump guard skipped');
    return report;
  }

  const facts: Record<string, VersionBumpFacts> = {};
  for (const [id, component] of model.components) {
    if (component.source_files.length === 0) continue;
    const sourceCommit = await lastCommitTouching(root, component.source_files);
    const versionCommit = await lastDesignVersionChange(root, componentFile(root, id));
    if (sourceCommit === undefined || versionCommit === undefined) continue;
    facts[id] = { sourceCommit, versionCommit, versionAfterSource: await bumpedAfterSourceChange(root, sourceCommit, versionCommit) };
  }

  const { violations, unchecked } = checkVersionBumps(model, facts);
  for (const v of violations) {
    report.errors.push(`guard: ${v.component}: source changed in ${v.sourceCommit.slice(0, 7)} but design_version is still ${v.designVersion}`);
  }
  for (const id of unchecked) report.warnings.push(`guard: ${id}: no git history for its source files`);
  return report;
}

/**
 * Core's guard compares the two commits for equality, so a bump made in a
 * later commit than the source edit would surface as a violation on hashes
 * alone. The CLI owns git, so it settles the ordering here and hands the
 * answer to core as `versionAfterSource`: a version commit that descends
 * from (or equals) the source commit means the bump happened after the
 * change, and core raises no violation for it.
 */
async function bumpedAfterSourceChange(root: string, sourceCommit: string, versionCommit: string): Promise<boolean> {
  if (sourceCommit === versionCommit) return true;
  return isAncestor(root, sourceCommit, versionCommit);
}

export async function runCheck(opts: CheckOptions, io: Io): Promise<number> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const distDir = opts.dist === undefined ? undefined : path.resolve(opts.dist);
  if (distDir !== undefined && !(fs.existsSync(distDir) && fs.statSync(distDir).isDirectory())) {
    io.err(`dist directory not found: ${opts.dist}`);
    return EXIT.NOINPUT;
  }

  const { model, problems } = loadProjectSafely(opts.root);
  for (const p of problems) errors.push(formatProblem(p));

  if (model) {
    const guard = await runGuard(opts.root, model);
    errors.push(...guard.errors);
    warnings.push(...guard.warnings);
  }

  if (distDir !== undefined) {
    const budgetKb = model?.config.byte_budget_kb ?? DEFAULT_BUDGET_KB;
    const { pages, warnings: budgetWarnings } = analyseDist(distDir, budgetKb);
    warnings.push(...budgetWarnings);
    const carbonPath = path.join(opts.root, CARBON_PATH);
    fs.mkdirSync(path.dirname(carbonPath), { recursive: true });
    fs.writeFileSync(carbonPath, `${canonicalJson(carbonDocument(pages))}\n`);
  }

  // Strict promotes only the hard carbon gate (over-budget pages); informational
  // warnings (guard skipped, missing assets) stay warnings either way.
  const promoted = opts.strict ? warnings.filter(isOverBudgetLine) : [];
  const remaining = opts.strict ? warnings.filter((w) => !isOverBudgetLine(w)) : warnings;
  errors.push(...promoted);

  for (const line of errors) io.err(line);
  for (const line of remaining) io.err(line);

  io.out(`errors: ${errors.length}, warnings: ${remaining.length}`);
  return errors.length > 0 ? EXIT.PROBLEMS : EXIT.OK;
}
