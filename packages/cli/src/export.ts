/**
 * `docsandeye export`: load the project and write the export plan's files —
 * BuildUp-flavoured Markdown plus an Open Know-How manifest — under
 * `<root>/<out>`, then copy in the media the plan lists. The plan comes from
 * `@docsandeye/core`; the CLI only writes.
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

  // Locally-hosted media is linked by its repo-relative path, so the bytes have
  // to travel with the tree. A manifest naming a file that is not in the
  // checkout is a warning, not a failure: the rest of the export is still good.
  let copied = 0;
  for (const asset of plan.assets) {
    const from = path.resolve(opts.root, ...asset.from.split('/'));
    if (!fs.existsSync(from)) {
      io.err(`warning: media file not found: ${asset.from}`);
      continue;
    }
    const to = path.resolve(opts.root, outputPath(asset.to, opts.out));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied += 1;
  }

  io.out(`exported ${plan.buildup.length} buildup files, 1 okh manifest, ${copied} assets copied`);
  return EXIT.OK;
}
