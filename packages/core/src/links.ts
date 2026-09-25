/**
 * Repo-relative links in step bodies. An author writes links that work on
 * GitHub — `[Cap](../../Components/Vial%20Cap)`, `[next](step-05-x.md)` —
 * and the site rewrites them:
 *
 * - a link to another step of the same guide (`docs/steps/<id>.md`) becomes
 *   that step's page (the renderer builds the href; see `LinkTarget`);
 * - any other path inside the project becomes a GitHub page,
 *   `<project.repo>/blob/<project.branch>/<path>` (`raw` for an image), when
 *   `project.repo` is set;
 * - otherwise, and for a path that climbs above the project root, the link is
 *   left as written and `docsandeye check` warns (`linkWarnings`).
 *
 * The project root is taken to be the repository root. Pure: no imports, no
 * filesystem, like `interactive.ts`.
 */

/** Branch used for GitHub links when `project.branch` is absent. */
export const DEFAULT_BRANCH = 'main';

/** Project-relative path of a step's file (steps are `docs/steps/<id>.md`). */
export function stepFilePath(stepId: string): string {
  return `docs/steps/${stepId}.md`;
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** True for a link the site must resolve: no scheme, not absolute, not a bare `#fragment` or `?query`. */
export function isRelativeLink(url: string): boolean {
  const u = url.trim();
  return u !== '' && !SCHEME_RE.test(u) && !u.startsWith('/') && !u.startsWith('#') && !u.startsWith('?');
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Resolve `url` against the directory of `fromFile` (both POSIX,
 * project-relative). Returns the decoded project-relative path (no trailing
 * slash; `''` for the root) and the `#fragment` as written (`''` when none), or
 * `undefined` when the path climbs above the project root. A `?query` is dropped.
 */
export function resolveRelativeLink(url: string, fromFile: string): { path: string; fragment: string } | undefined {
  const hash = url.indexOf('#');
  const fragment = hash === -1 ? '' : url.slice(hash);
  const beforeHash = hash === -1 ? url : url.slice(0, hash);
  const query = beforeHash.indexOf('?');
  const target = query === -1 ? beforeHash : beforeHash.slice(0, query);
  const out = fromFile.split('/').slice(0, -1).filter(Boolean);
  for (const raw of target.split('/')) {
    const segment = decodeSegment(raw);
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return undefined;
      out.pop();
    } else {
      out.push(segment);
    }
  }
  return { path: out.join('/'), fragment };
}

/**
 * `https://github.com/o/r` + `main` + `Components/Vial Cap` →
 * `https://github.com/o/r/blob/main/Components/Vial%20Cap`. `raw` serves the
 * file's bytes (for an image source) instead of GitHub's page about it.
 */
export function repoBlobUrl(repo: string, branch: string, filePath: string, fragment = '', raw = false): string {
  const encode = (p: string) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const tail = encode(filePath);
  // The root is a tree page; GitHub redirects `blob` to `tree` for any other folder.
  return `${repo.replace(/\/+$/, '')}/${tail ? (raw ? 'raw' : 'blob') : 'tree'}/${encode(branch)}${tail ? `/${tail}` : ''}${fragment}`;
}

export interface LinkContext {
  /** Project-relative path of the step file holding the link. */
  stepFile: string;
  /** Ids of the steps in the guide being rendered. */
  stepIds: ReadonlySet<string>;
  /** `project.repo`; without it only step links are rewritten. */
  repo?: string;
  /** `project.branch`, or `DEFAULT_BRANCH`. */
  branch: string;
}

export type LinkTarget =
  /** Another step of the guide: link to its page, keeping `fragment`. */
  | { kind: 'step'; stepId: string; fragment: string }
  /** A file or folder of the repository, on GitHub. */
  | { kind: 'repo'; href: string }
  /** Left as written: above the project root, or no `project.repo` to link to. */
  | { kind: 'unresolved'; reason: 'outside-project' | 'no-repo' };

/**
 * Where a link in a step body goes on the site; `undefined` for a link that is
 * not relative (left alone, no warning). An `image` source on GitHub is its
 * `raw` URL, so the picture loads.
 */
export function linkTarget(url: string, ctx: LinkContext, image = false): LinkTarget | undefined {
  if (!isRelativeLink(url)) return undefined;
  const resolved = resolveRelativeLink(url.trim(), ctx.stepFile);
  if (!resolved) return { kind: 'unresolved', reason: 'outside-project' };
  const step = /^docs\/steps\/([^/]+)\.md$/.exec(resolved.path);
  if (step && ctx.stepIds.has(step[1]!)) return { kind: 'step', stepId: step[1]!, fragment: resolved.fragment };
  if (ctx.repo === undefined) return { kind: 'unresolved', reason: 'no-repo' };
  return { kind: 'repo', href: repoBlobUrl(ctx.repo, ctx.branch, resolved.path, resolved.fragment, image) };
}

/**
 * The link and image destinations in a Markdown text, with their 1-based line:
 * inline `[t](url)` / `![a](url "title")`, reference definitions `[r]: url`,
 * and raw HTML `<a href>` / `<img src>`. Fenced code blocks and inline code
 * are skipped. A scan, not a parser: it finds what `docsandeye check` warns
 * about; the renderer works on the real syntax tree.
 */
export function markdownLinks(markdown: string): { url: string; line: number }[] {
  const out: { url: string; line: number }[] = [];
  let fence: string | undefined;
  markdown.split('\n').forEach((text, i) => {
    const line = i + 1;
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(text)?.[1];
    if (fence !== undefined) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return;
    }
    if (marker) {
      fence = marker;
      return;
    }
    const plain = text.replace(/(`+)[\s\S]*?\1/g, '');
    const def = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]*)>|(\S+))/.exec(plain);
    if (def) out.push({ url: def[1] ?? def[2]!, line });
    for (const m of plain.matchAll(/\]\(\s*(?:<([^>]*)>|([^\s)]+))/g)) out.push({ url: m[1] ?? m[2]!, line });
    for (const m of plain.matchAll(/<(?:a|img)\b[^>]*?\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) out.push({ url: m[1] ?? m[2]!, line });
  });
  return out;
}

/** The warning `docsandeye check` gives for a link the site leaves as written. */
export function unresolvedLinkMessage(url: string, reason: 'outside-project' | 'no-repo', guideId: string): string {
  return reason === 'outside-project'
    ? `link "${url}" points above the project root; the site leaves it as written`
    : `link "${url}" is not a step of guide "${guideId}" and project.repo is not set; the site leaves it as written (it works only on GitHub)`;
}
