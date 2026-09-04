/**
 * `docsandeye render`: load the project, write `build/render-plan.json` and
 * hand it to `python3 -m docsandeye_render`. The CLI owns process spawning;
 * the plan itself comes from `@docsandeye/core`.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildRenderPlan, canonicalJson } from '@docsandeye/core';
import { EXIT, formatProblem, loadProjectSafely, type Io } from './common.js';
import { renderDir } from './paths.js';

export const RENDER_PLAN_PATH = 'build/render-plan.json';
export const RENDER_OUT_PATH = 'build/render';
export const PYTHON_MISSING_MESSAGE = 'python3 not found: install Python 3.11+';

export interface RenderOptions {
  root: string;
  force: boolean;
  allowMissing: boolean;
}

/** argv handed to `python3` (after the program name). */
export function pythonArgs(opts: { force: boolean; allowMissing: boolean }): string[] {
  const args = ['-m', 'docsandeye_render', 'render', '--plan', RENDER_PLAN_PATH, '--out', RENDER_OUT_PATH, '--project-root', '.'];
  if (opts.force) args.push('--force');
  if (opts.allowMissing) args.push('--allow-missing');
  return args;
}

/** `PYTHONPATH` for the child: the render dir first, then whatever the parent had. */
export function pythonPath(env: NodeJS.ProcessEnv = process.env): string {
  const inherited = env.PYTHONPATH;
  const dir = renderDir(env);
  return inherited !== undefined && inherited !== '' ? `${dir}${path.delimiter}${inherited}` : dir;
}

export async function runRender(opts: RenderOptions, io: Io): Promise<number> {
  const { model, problems } = loadProjectSafely(opts.root);
  if (problems.length > 0 || !model) {
    for (const p of problems) io.err(formatProblem(p));
    return EXIT.PROBLEMS;
  }

  const plan = buildRenderPlan(model);
  const planPath = path.join(opts.root, RENDER_PLAN_PATH);
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, `${canonicalJson(plan)}\n`);

  return spawnPython(pythonArgs(opts), opts.root, io);
}

function spawnPython(args: string[], cwd: string, io: Io): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('python3', args, {
      cwd,
      env: { ...process.env, PYTHONPATH: pythonPath() },
      stdio: 'inherit',
    });
    let settled = false;
    const finish = (code: number): void => {
      if (!settled) {
        settled = true;
        resolve(code);
      }
    };
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') io.err(PYTHON_MISSING_MESSAGE);
      else io.err(`python3 could not be started: ${err.message}`);
      finish(EXIT.UNAVAILABLE);
    });
    child.on('close', (code, signal) => {
      if (code !== null) finish(code);
      else {
        io.err(`python3 terminated by signal ${signal ?? 'unknown'}`);
        finish(EXIT.PROBLEMS);
      }
    });
  });
}
