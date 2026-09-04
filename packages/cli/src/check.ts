/**
 * `docsandeye check`: content validation, the version-bump guard against
 * real git history, and (with `--dist`) the per-page byte budget plus the
 * CO2.js estimate written to `build/carbon.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, checkVersionBumps, type ProjectModel, type VersionBumpFacts, type Violation } from '@docsandeye/core';
import { analyseDist, carbonDocument } from './budget.js';
import { EXIT, formatProblem, loadProjectSafely, type Io } from './common.js';
import { isAncestor, isInsideWorkTree, lastCommitTouching, lastDesignVersionChange } from './git.js';

export const CARBON_PATH = 'build/carbon.json';
export const DEFAULT_BUDGET_KB = 150;

export interface CheckOptions {
  root: string;
  /** Built site directory; budget and carbon steps run only when set. */
  dist?: string;
  strict: boolean;
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
    if (sourceCommit !== undefined && versionCommit !== undefined) facts[id] = { sourceCommit, versionCommit };
  }

  const { violations, unchecked } = checkVersionBumps(model, facts);
  for (const v of violations) {
    if (await bumpedAfterSourceChange(root, v)) continue;
    report.errors.push(`guard: ${v.component}: source changed in ${v.sourceCommit.slice(0, 7)} but design_version is still ${v.designVersion}`);
  }
  for (const id of unchecked) report.warnings.push(`guard: ${id}: no git history for its source files`);
  return report;
}

/**
 * Core's guard compares the two commits for equality, so a bump made in a
 * later commit than the source edit still surfaces as a violation. The CLI
 * owns git, so it settles the ordering: a version commit that descends from
 * the source commit means the bump happened after the change and clears it.
 */
async function bumpedAfterSourceChange(root: string, v: Violation): Promise<boolean> {
  return isAncestor(root, v.sourceCommit, v.versionCommit);
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

  for (const line of errors) io.err(line);
  for (const line of warnings) io.err(line);

  const errorCount = opts.strict ? errors.length + warnings.length : errors.length;
  const warningCount = opts.strict ? 0 : warnings.length;
  io.out(`errors: ${errorCount}, warnings: ${warningCount}`);
  return errorCount > 0 ? EXIT.PROBLEMS : EXIT.OK;
}
