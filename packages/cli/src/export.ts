/**
 * `docsandeye export`: load the project and write the export plan's files —
 * BuildUp-flavoured Markdown plus an Open Know-How manifest — under
 * `<root>/<out>`. The plan comes from `@docsandeye/core`; the CLI only writes.
 *
 * An invalid project behaves exactly as `render` does: problems printed, exit 1,
 * nothing written. Re-running overwrites the plan's own files and touches
 * nothing else under the output directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXPORT_OUTPUT_DIR, buildExportPlan, type ExportFile } from '@docsandeye/core';
import { EXIT, formatProblem, loadProjectSafely, type Io } from './common.js';

export const DEFAULT_EXPORT_OUT = EXPORT_OUTPUT_DIR;

export interface ExportOptions {
  root: string;
  /** Output directory, relative to `root` unless absolute. */
  out: string;
}

/** Swap the plan's `build/export/` prefix for the requested output directory. */
export function outputPath(planPath: string, out: string): string {
  const prefix = `${EXPORT_OUTPUT_DIR}/`;
  const rel = planPath.startsWith(prefix) ? planPath.slice(prefix.length) : planPath;
  return path.join(out, ...rel.split('/'));
}

export function runExport(opts: ExportOptions, io: Io): number {
  const { model, problems } = loadProjectSafely(opts.root);
  if (problems.length > 0 || !model) {
    for (const p of problems) io.err(formatProblem(p));
    return EXIT.PROBLEMS;
  }

  const plan = buildExportPlan(model);
  const files: ExportFile[] = [...plan.buildup, plan.okh];
  for (const file of files) {
    const abs = path.resolve(opts.root, outputPath(file.path, opts.out));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.content);
  }

  io.out(`exported ${plan.buildup.length} buildup files, 1 okh manifest`);
  return EXIT.OK;
}
