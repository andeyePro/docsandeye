/**
 * The link rewriting in step bodies: `rewriteLink` over core's resolver, the
 * raw-HTML pass, and `renderMarkdown` with and without per-render options.
 * The built fixture pages are asserted in `interactive.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { linkOptionsFor, rewriteHtmlLinks, rewriteLink, type LinkOptions } from '../src/links.ts';
import { renderMarkdown } from '../src/markdown.ts';

const REPO = 'https://github.com/o/r';
const opts = (over: Partial<LinkOptions> = {}): LinkOptions => ({
  ...linkOptionsFor({ id: 'step-01' }, { base: '/AEP' }, [{ id: 'step-01' }, { id: 'step-05-set-up' }], { repo: REPO }, '/docs/'),
  ...over,
});

describe('rewriteLink', () => {
  it('a step of the guide → its page under the site base, fragment kept', () => {
    expect(rewriteLink('step-05-set-up.md', opts())).toBe('/docs/AEP/step-05-set-up/');
    expect(rewriteLink('./step-05-set-up.md#wiring', opts())).toBe('/docs/AEP/step-05-set-up/#wiring');
  });

  it('other project paths → GitHub on the branch (main by default), encoded, no trailing slash', () => {
    expect(rewriteLink('../../Components/Vial%20Cap', opts())).toBe(`${REPO}/blob/main/Components/Vial%20Cap`);
    expect(rewriteLink('../../AEP-Plugin/README.md#over-ssh', opts({ branch: 'dev' }))).toBe(`${REPO}/blob/dev/AEP-Plugin/README.md#over-ssh`);
    expect(rewriteLink('../components/', opts())).toBe(`${REPO}/blob/main/docs/components`);
    expect(rewriteLink('../../img/a b.png', opts(), true)).toBe(`${REPO}/raw/main/img/a%20b.png`);
  });

  it('left as written: no repo, above the root, or not relative', () => {
    expect(rewriteLink('../components/', opts({ repo: undefined }))).toBe('../components/');
    expect(rewriteLink('../../../x.md', opts())).toBe('../../../x.md');
    for (const url of ['https://x.org', 'mailto:a@b.c', '#top', '/abs/']) expect(rewriteLink(url, opts())).toBe(url);
  });
});

describe('rewriteHtmlLinks', () => {
  it('rewrites href of <a> and src of <img> only', () => {
    const seen: [string, boolean][] = [];
    const out = rewriteHtmlLinks('<a class="x" href="a.md">A</a><img src=\'b.png\' alt=""><link href="c.css">', (url, image) => {
      seen.push([url, image]);
      return `R(${url})`;
    });
    expect(out).toBe('<a class="x" href="R(a.md)">A</a><img src=\'R(b.png)\' alt=""><link href="c.css">');
    expect(seen).toEqual([
      ['a.md', false],
      ['b.png', true],
    ]);
  });
});

describe('renderMarkdown with link options', () => {
  const md = '[next](step-05-set-up.md) [cap](../../Cap/) ![p](../../p.png)\n\n[ref][r]\n\n[r]: ../../R.md\n\n<a href="../components/">parts</a>\n';

  it('rewrites links, images, definitions and raw HTML', async () => {
    const html = await renderMarkdown(md, opts());
    expect(html).toContain('<a href="/docs/AEP/step-05-set-up/">next</a>');
    expect(html).toContain(`<a href="${REPO}/blob/main/Cap">cap</a>`);
    expect(html).toContain(`<img src="${REPO}/raw/main/p.png" alt="p">`);
    expect(html).toContain(`<a href="${REPO}/blob/main/R.md">ref</a>`);
    expect(html).toContain(`<a href="${REPO}/blob/main/docs/components">parts</a>`);
  });

  it('without options every link is left as written', async () => {
    const html = await renderMarkdown(md);
    expect(html).toContain('<a href="step-05-set-up.md">next</a>');
    expect(html).toContain('<a href="../components/">parts</a>');
  });
});
