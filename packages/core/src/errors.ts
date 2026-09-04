/**
 * Problem and error shapes shared by every Docs&I package.
 *
 * `Problem.path` is a dotted, JSON-pointer-style path into the YAML document
 * (`design_version`, `changelog.1.version`); `""` means the whole file.
 */

/** Stable problem codes for v0.1 — exactly these, nothing else. */
export const PROBLEM_CODES = [
  'invalid-yaml',
  'schema',
  'id-mismatch',
  'unknown-component',
  'unknown-media',
  'unknown-guide',
  'future-pin',
  'duplicate-id',
] as const;

export type ProblemCode = (typeof PROBLEM_CODES)[number];

export interface Problem {
  code: ProblemCode;
  /** Repo-relative file path (or the bare filename passed to a parse function). */
  file: string;
  /** Dotted path within the document; `""` for file-level problems. */
  path: string;
  message: string;
}

export class DocsiError extends Error {
  readonly problems: Problem[];

  constructor(problems: Problem[], message?: string) {
    super(message ?? summarise(problems));
    this.name = 'DocsiError';
    this.problems = problems;
  }
}

function summarise(problems: Problem[]): string {
  if (problems.length === 0) return 'Docs&I error';
  const first = problems[0]!;
  const where = first.path ? `${first.file}:${first.path}` : first.file;
  const more = problems.length > 1 ? ` (+${problems.length - 1} more)` : '';
  return `${first.code} at ${where}: ${first.message}${more}`;
}

/** Ordering used everywhere problems are reported: by `file`, then `path`. */
export function compareProblems(a: Problem, b: Problem): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return 0;
}

/** Sorts a problem list in place by `file` then `path` and returns it. */
export function sortProblems(problems: Problem[]): Problem[] {
  return problems.sort(compareProblems);
}
