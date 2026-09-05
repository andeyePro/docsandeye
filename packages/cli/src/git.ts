/**
 * Git facts for the version-bump guard and the geometry restore behind
 * `docsandeye diff`. Every call is `execFile` with an argument array; nothing
 * here goes through a shell.
 */
import { execFile } from 'node:child_process';

export interface GitResult {
  ok: boolean;
  stdout: string;
}

const MAX_BUFFER = 64 * 1024 * 1024;

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER }, (error, stdout) => {
      resolve({ ok: !error, stdout: typeof stdout === 'string' ? stdout : '' });
    });
  });
}

/** Like `runGit`, but stdout as raw bytes (for blobs such as STL/GLB files). */
function runGitBytes(cwd: string, args: string[]): Promise<{ ok: boolean; stdout: Buffer }> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, encoding: 'buffer', maxBuffer: MAX_BUFFER }, (error, stdout) => {
      resolve({ ok: !error, stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.alloc(0) });
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

/**
 * Full hash of the last commit whose diff of `file` added or removed a line
 * matching `pattern` (`git log -1 --format=%H -G<pattern> -- <file>`). The
 * pattern is one argv element, passed to git verbatim: no shell, no quoting.
 */
export async function lastCommitMatching(cwd: string, file: string, pattern: string): Promise<string | undefined> {
  const r = await runGit(cwd, ['log', '-1', '--format=%H', `-G${pattern}`, '--', file]);
  const hash = r.stdout.trim();
  return r.ok && hash !== '' ? hash : undefined;
}

/**
 * Bytes of `file` (relative to `cwd`) at `rev`, or undefined when git cannot
 * show it: unknown revision (e.g. `<root>^`), path absent at that commit, or
 * no git at all. The `./` prefix makes git resolve the path against `cwd`
 * rather than the repository root.
 */
export async function showFileAt(cwd: string, rev: string, file: string): Promise<Buffer | undefined> {
  const r = await runGitBytes(cwd, ['show', `${rev}:./${file}`]);
  return r.ok ? r.stdout : undefined;
}

/** True when `file` (relative to `cwd`) exists at `rev` (`git cat-file -e <rev>:./<file>`). */
export async function existsAt(cwd: string, rev: string, file: string): Promise<boolean> {
  const r = await runGit(cwd, ['cat-file', '-e', `${rev}:./${file}`]);
  return r.ok;
}

/** Full hash of the commit `ref` names (`git rev-parse --verify <ref>^{commit}`), or undefined. */
export async function revParse(cwd: string, ref: string): Promise<string | undefined> {
  const r = await runGit(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
  const hash = r.stdout.trim();
  return r.ok && /^[0-9a-f]{40}$/.test(hash) ? hash : undefined;
}
