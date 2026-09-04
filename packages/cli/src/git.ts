/**
 * Git facts for the version-bump guard. Every call is `execFile` with an
 * argument array; nothing here goes through a shell.
 */
import { execFile } from 'node:child_process';

export interface GitResult {
  ok: boolean;
  stdout: string;
}

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      resolve({ ok: !error, stdout: typeof stdout === 'string' ? stdout : '' });
    });
  });
}

/** `git rev-parse --is-inside-work-tree` succeeds inside a repository (also when git is missing → false). */
export async function isInsideWorkTree(cwd: string): Promise<boolean> {
  const r = await runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  return r.ok && r.stdout.trim() === 'true';
}

/** Full hash of the last commit touching any of `files` (paths relative to `cwd`), or undefined when none. */
export async function lastCommitTouching(cwd: string, files: readonly string[]): Promise<string | undefined> {
  if (files.length === 0) return undefined;
  const r = await runGit(cwd, ['log', '-1', '--format=%H', '--', ...files]);
  const hash = r.stdout.trim();
  return r.ok && hash !== '' ? hash : undefined;
}

/** Full hash of the last commit whose diff of `file` added or removed a `design_version:` line. */
export async function lastDesignVersionChange(cwd: string, file: string): Promise<string | undefined> {
  const r = await runGit(cwd, ['log', '-1', '--format=%H', '-G^design_version:', '--', file]);
  const hash = r.stdout.trim();
  return r.ok && hash !== '' ? hash : undefined;
}

/** True when `ancestor` is an ancestor of (or equal to) `descendant`. */
export async function isAncestor(cwd: string, ancestor: string, descendant: string): Promise<boolean> {
  const r = await runGit(cwd, ['merge-base', '--is-ancestor', ancestor, descendant]);
  return r.ok;
}
