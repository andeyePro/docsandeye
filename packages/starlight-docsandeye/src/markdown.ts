/**
 * Step bodies are Markdown rendered with Astro's own pipeline
 * (`@astrojs/markdown-remark`), created once per build, plus
 * `remark-directive`, the Starlight-style asides (`asides.ts`) and the
 * repo-relative link rewriting (`links.ts`), whose per-render options travel
 * in the file's frontmatter data so the one processor serves every step.
 */
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { remarkDocsiAsides } from './asides.ts';
import { remarkDocsiLinks, type LinkOptions } from './links.ts';

type Processor = Awaited<ReturnType<typeof createMarkdownProcessor>>;

let processor: Promise<Processor> | undefined;

/** Render a step's Markdown; with `links`, its relative links are rewritten for the site (without, they are left as written). */
export async function renderMarkdown(body: string, links?: LinkOptions): Promise<string> {
  processor ??= createMarkdownProcessor({ remarkPlugins: [remarkDirective, remarkDocsiAsides, remarkDocsiLinks] as never });
  const result = await (await processor).render(body, links ? { frontmatter: { docsiLinks: links } } : undefined);
  return result.code;
}
