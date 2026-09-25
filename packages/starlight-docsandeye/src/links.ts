/**
 * Repo-relative links in step bodies (`[Cap](../../Components/Vial%20Cap)`,
 * `[next](step-05-x.md)`), rewritten for the site by core's `linkTarget`: a
 * step of the same guide becomes its page, anything else in the project a
 * GitHub page on `project.repo`, and what cannot be resolved is left as
 * written (`docsandeye check` warns about it).
 *
 * `renderMarkdown` keeps one processor per build, so the per-render options
 * travel in the file's data (`astro.frontmatter.docsiLinks`); a render
 * without them leaves every link alone. Covers Markdown links, images and
 * reference definitions, and `href`/`src` of raw HTML `<a>` and `<img>` tags.
 */
import { DEFAULT_BRANCH, linkTarget, stepFilePath, type Guide, type LinkContext, type Step } from '@docsandeye/core';
import { stepHref } from './view.ts';

export interface LinkOptions {
  /** Project-relative path of the step's `.md` file. */
  stepFile: string;
  guide: Pick<Guide, 'base'>;
  /** Astro's `BASE_URL`. */
  siteBase: string;
  /** The steps of the same guide. */
  steps: readonly Pick<Step, 'id'>[];
  /** `project.repo`. */
  repo?: string;
  /** `project.branch`, or `DEFAULT_BRANCH` (`main`). */
  branch: string;
}

/** Link options for a step of a guide, from the loaded config. */
export function linkOptionsFor(
  step: Pick<Step, 'id'>,
  guide: Pick<Guide, 'base'>,
  steps: readonly Pick<Step, 'id'>[],
  project: { repo?: string; branch?: string } | undefined,
  siteBase: string,
): LinkOptions {
  return { stepFile: stepFilePath(step.id), guide, siteBase, steps, repo: project?.repo, branch: project?.branch ?? DEFAULT_BRANCH };
}

/** The site URL for a link in a step body; the link unchanged when it is not relative or cannot be resolved. */
export function rewriteLink(url: string, opts: LinkOptions, image = false): string {
  const ctx: LinkContext = { stepFile: opts.stepFile, stepIds: new Set(opts.steps.map((s) => s.id)), repo: opts.repo, branch: opts.branch };
  const target = linkTarget(url, ctx, image);
  if (target?.kind === 'step') return `${stepHref(opts.guide, target.stepId, opts.siteBase)}${target.fragment}`;
  if (target?.kind === 'repo') return target.href;
  return url;
}

interface MdNode {
  type: string;
  url?: string;
  value?: string;
  children?: MdNode[];
}

const HTML_TAG_RE = /<(a|img)\b[^>]*>/gi;
const HTML_ATTR_RE = /(\s(?:href|src)\s*=\s*)("([^"]*)"|'([^']*)')/gi;

/** `href`/`src` of each `<a>`/`<img>` tag in a raw HTML string, rewritten (`image` is true for an `<img>`). */
export function rewriteHtmlLinks(html: string, rewrite: (url: string, image: boolean) => string): string {
  return html.replace(HTML_TAG_RE, (tag, name: string) =>
    tag.replace(HTML_ATTR_RE, (_m, lead: string, quoted: string, dq?: string, sq?: string) => {
      const url = dq ?? sq ?? '';
      const quote = quoted[0]!;
      return `${lead}${quote}${rewrite(url, name.toLowerCase() === 'img')}${quote}`;
    }),
  );
}

export function remarkDocsiLinks() {
  return (tree: MdNode, file: { data?: { astro?: { frontmatter?: Record<string, unknown> } } }) => {
    const opts = file?.data?.astro?.frontmatter?.docsiLinks as LinkOptions | undefined;
    if (!opts) return;
    const rewrite = (url: string, image: boolean) => rewriteLink(url, opts, image);
    const visit = (node: MdNode) => {
      if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && node.url !== undefined) node.url = rewrite(node.url, node.type === 'image');
      else if (node.type === 'html' && node.value !== undefined) node.value = rewriteHtmlLinks(node.value, rewrite);
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
