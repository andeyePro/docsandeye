/**
 * `docsandeye encode`: load the project, write `build/media-plan.json` and
 * hand it to `python3 -m docsandeye_render encode`. The same shape as
 * `render` — the plan comes from `@docsandeye/core`, the CLI owns spawning —
 * and it reuses `render.ts`'s spawn helper so both commands agree on
 * `PYTHONPATH`, exit codes and the `python3` missing message.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildMediaPlan, canonicalJson } from '@docsandeye/core';
import { EXIT, formatProblem, loadProjectSafely, type Io } from './common.js';
import { spawnPython } from './render.js';

export const MEDIA_PLAN_PATH = 'build/media-plan.json';
export const MEDIA_OUT_PATH = 'build/media';

export interface EncodeOptions {
  root: string;
  force: boolean;
  allowMissing: boolean;
}

/** argv handed to `python3` (after the program name). */
export function encodeArgs(opts: { force: boolean; allowMissing: boolean }): string[] {
  const args = ['-m', 'docsandeye_render', 'encode', '--plan', MEDIA_PLAN_PATH, '--out', MEDIA_OUT_PATH, '--project-root', '.'];
  if (opts.force) args.push('--force');
  if (opts.allowMissing) args.push('--allow-missing');
  return args;
}

export async function runEncode(opts: EncodeOptions, io: Io): Promise<number> {
  const { model, problems } = loadProjectSafely(opts.root);
  if (problems.length > 0 || !model) {
    for (const p of problems) io.err(formatProblem(p));
    return EXIT.PROBLEMS;
  }

  const plan = buildMediaPlan(model);
  const planPath = path.join(opts.root, MEDIA_PLAN_PATH);
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, `${canonicalJson(plan)}\n`);

  return spawnPython(encodeArgs(opts), opts.root, io);
}
