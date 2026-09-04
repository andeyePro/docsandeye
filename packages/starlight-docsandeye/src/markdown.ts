/**
 * Step bodies are Markdown rendered with Astro's own pipeline
 * (`@astrojs/markdown-remark`), created once per build.
 */
import { createMarkdownProcessor } from '@astrojs/markdown-remark';

type Processor = Awaited<ReturnType<typeof createMarkdownProcessor>>;

let processor: Promise<Processor> | undefined;

export async function renderMarkdown(body: string): Promise<string> {
  processor ??= createMarkdownProcessor();
  const result = await (await processor).render(body);
  return result.code;
}
