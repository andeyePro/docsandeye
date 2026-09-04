/**
 * Shared pieces: exit codes, problem formatting and project loading that
 * turns a thrown `DocsiError` (unusable config) into a problem list.
 */
import { DocsiError, loadProject, type Problem, type ProjectModel } from '@docsandeye/core';

/** sysexits-style codes shared by every subcommand. */
export const EXIT = {
  OK: 0,
  /** Content problems, guard violations, or the render pipeline reported failures. */
  PROBLEMS: 1,
  /** The render pipeline is unavailable (`python3` missing) or aborted. */
  UNAVAILABLE: 2,
  /** Bad command line. */
  USAGE: 64,
  /** `init` refused to overwrite an existing project. */
  DATAERR: 65,
  /** No project (or `--dist` directory) found. */
  NOINPUT: 66,
} as const;

/** `<file>:<path>: <code>: <message>` — the one-line form used everywhere. */
export function formatProblem(p: Problem): string {
  return `${p.file}:${p.path}: ${p.code}: ${p.message}`;
}

export interface LoadedProject {
  model?: ProjectModel;
  problems: Problem[];
}

/** `loadProject`, but a config that cannot be parsed becomes problems instead of an exception. */
export function loadProjectSafely(root: string): LoadedProject {
  try {
    const model = loadProject(root);
    return { model, problems: model.problems };
  } catch (err) {
    if (err instanceof DocsiError) return { problems: err.problems };
    throw err;
  }
}

export interface Io {
  out(line: string): void;
  err(line: string): void;
}

export const processIo: Io = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};
