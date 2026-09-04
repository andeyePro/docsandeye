/**
 * Filesystem locations the CLI needs: the project root (found by walking up
 * from cwd to the first `docsandeye.config.yaml`), this package's directory
 * and the Python render pipeline's import root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILENAME } from '@docsandeye/core';

/** Walk up from `start` to the first directory containing `docsandeye.config.yaml`. */
export function findProjectRoot(start: string): string | undefined {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, CONFIG_FILENAME))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Absolute path of `packages/cli` (this file is emitted to `dist/`, one level below). */
export function cliPackageDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/** Directory added to `PYTHONPATH` so `python3 -m docsandeye_render` resolves. */
export function renderDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.DOCSANDEYE_RENDER_PYTHONPATH;
  if (override !== undefined && override !== '') return override;
  return path.resolve(cliPackageDir(), '../../render');
}

/** Absolute path to `templates/` shipped with the package. */
export function templatesDir(): string {
  return path.join(cliPackageDir(), 'templates');
}

/** Package version from `package.json`. */
export function packageVersion(): string {
  const text = fs.readFileSync(path.join(cliPackageDir(), 'package.json'), 'utf8');
  return (JSON.parse(text) as { version: string }).version;
}
