/**
 * Step bodies are Markdown rendered with Astro's own pipeline
 * (`@astrojs/markdown-remark`), created once per build, plus
 * `remark-directive` and the Starlight-style asides (`asides.ts`).
 */
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { remarkDocsiAsides } from './asides.ts';

type Processor = Awaited<ReturnType<typeof createMarkdownProcessor>>;

let processor: Promise<Processor> | undefined;

export async function renderMarkdown(body: string): Promise<string> {
  processor ??= createMarkdownProcessor({ remarkPlugins: [remarkDirective, remarkDocsiAsides] as never });
  const result = await (await processor).render(body);
  return result.code;
}
