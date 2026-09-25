/**
 * Repo-relative links in step bodies: resolution against the step file,
 * the step / GitHub / unresolved rules, encoding and fragments, the scan
 * `docsandeye check` uses, and the loader's warnings.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isRelativeLink, linkTarget, loadProject, markdownLinks, parseConfig, repoBlobUrl, resolveRelativeLink, type LinkContext } from '../src/index.js';

const FILE = 'docs/steps/step-01.md';
const REPO = 'https://github.com/o/r';
const ctx = (over: Partial<LinkContext> = {}): LinkContext => ({ stepFile: FILE, stepIds: new Set(['step-01', 'step-05']), repo: REPO, branch: 'main', ...over });

describe('isRelativeLink', () => {
  it('only paths without a scheme, not absolute, not a fragment', () => {
    for (const url of ['step-05.md', './x', '../../A/B', 'a?b']) expect(isRelativeLink(url)).toBe(true);
    for (const url of ['https://x.org', 'mailto:a@b.c', 'tel:1', '/abs', '//cdn.x/y', '#frag', '?q', '']) expect(isRelativeLink(url)).toBe(false);
  });
});

describe('resolveRelativeLink', () => {
  it('resolves against the step directory, decoding segments and keeping the fragment', () => {
    expect(resolveRelativeLink('../../Components/Vial%20Cap', FILE)).toEqual({ path: 'Components/Vial Cap', fragment: '' });
    expect(resolveRelativeLink('../components/', FILE)).toEqual({ path: 'docs/components', fragment: '' });
    expect(resolveRelativeLink('./step-05.md?plain=1#fit', FILE)).toEqual({ path: 'docs/steps/step-05.md', fragment: '#fit' });
  });

  it('a path above the project root is undefined', () => {
    expect(resolveRelativeLink('../../../x.md', FILE)).toBeUndefined();
    expect(resolveRelativeLink('../../a/../../x', FILE)).toBeUndefined();
  });
});

describe('linkTarget', () => {
  it('a step of the guide is a step target, fragment kept', () => {
    expect(linkTarget('step-05.md#fit', ctx())).toEqual({ kind: 'step', stepId: 'step-05', fragment: '#fit' });
    expect(linkTarget('../steps/step-01.md', ctx())).toEqual({ kind: 'step', stepId: 'step-01', fragment: '' });
  });

  it('a step of another guide, or any other file, goes to GitHub on the branch', () => {
    expect(linkTarget('other-01.md', ctx())).toEqual({ kind: 'repo', href: `${REPO}/blob/main/docs/steps/other-01.md` });
    expect(linkTarget('../../AEP-Plugin/README.md#over-ssh', ctx({ branch: 'dev' }))).toEqual({ kind: 'repo', href: `${REPO}/blob/dev/AEP-Plugin/README.md#over-ssh` });
  });

  it('encodes segments once, strips the trailing slash, and uses raw for images', () => {
    expect(linkTarget('../../Components/Vial%20Cap/', ctx())).toEqual({ kind: 'repo', href: `${REPO}/blob/main/Components/Vial%20Cap` });
    expect(linkTarget('../../a b/c%23d.png', ctx(), true)).toEqual({ kind: 'repo', href: `${REPO}/raw/main/a%20b/c%23d.png` });
    expect(repoBlobUrl(`${REPO}/`, 'feature/x', 'A/B')).toBe(`${REPO}/blob/feature/x/A/B`);
    expect(repoBlobUrl(REPO, 'main', '')).toBe(`${REPO}/tree/main`);
  });

  it('without a repo, a non-step link is unresolved; above the root it always is', () => {
    expect(linkTarget('../components/', ctx({ repo: undefined }))).toEqual({ kind: 'unresolved', reason: 'no-repo' });
    expect(linkTarget('step-05.md', ctx({ repo: undefined }))).toEqual({ kind: 'step', stepId: 'step-05', fragment: '' });
    expect(linkTarget('../../../x', ctx())).toEqual({ kind: 'unresolved', reason: 'outside-project' });
  });

  it('non-relative links are not targets', () => {
    for (const url of ['https://x.org/a', 'mailto:a@b.c', '#top', '/kit/']) expect(linkTarget(url, ctx())).toBeUndefined();
  });
});

describe('markdownLinks', () => {
  it('finds inline links, images, definitions and HTML tags with their lines; skips code', () => {
    const md = ['[a](one.md) and ![i](<two words.png> "t")', '```', '[no](code.md)', '```', 'Use `[no](inline.md)`.', '[ref]: three.md', '<a href="four/">x</a> <img src=\'five.png\'>'].join('\n');
    expect(markdownLinks(md)).toEqual([
      { url: 'one.md', line: 1 },
      { url: 'two words.png', line: 1 },
      { url: 'three.md', line: 6 },
      { url: 'four/', line: 7 },
      { url: 'five.png', line: 7 },
    ]);
  });
});

describe('project.branch', () => {
  it('is an optional string in the strict project block', () => {
    const config = parseConfig('guides: [{id: g, title: G, base: /g}]\nproject: {repo: "https://github.com/o/r", branch: dev}\n');
    expect(config.project?.branch).toBe('dev');
    expect(parseConfig('guides: [{id: g, title: G, base: /g}]\nproject: {}\n').project?.branch).toBeUndefined();
  });
});

describe('loader: link warnings', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function project(config: string, body: string): string {
    const root = mkdtempSync(join(tmpdir(), 'docsandeye-links-'));
    dirs.push(root);
    mkdirSync(join(root, 'docs/steps'), { recursive: true });
    writeFileSync(join(root, 'docsandeye.config.yaml'), config);
    writeFileSync(join(root, 'docs/steps/s1.md'), `---\nid: s1\norder: 1\ntitle: One\n---\n${body}`);
    writeFileSync(join(root, 'docs/steps/s2.md'), `---\nid: s2\norder: 2\ntitle: Two\n---\nTwo.\n`);
    return root;
  }

  const GUIDES = 'guides:\n  - {id: g, title: G, base: /g}\n';
  const BODY = 'See [two](s2.md) and [cap](../../Components/Cap).\n\nNot [out](../../../x.md).\n';

  it('without a repo: every non-step link, at its file line', () => {
    const warnings = loadProject(project(GUIDES, BODY)).warnings!;
    expect(warnings.map((w) => `${w.path}: ${w.message}`)).toEqual([
      'body.line.6: link "../../Components/Cap" is not a step of guide "g" and project.repo is not set; the site leaves it as written (it works only on GitHub)',
      'body.line.8: link "../../../x.md" points above the project root; the site leaves it as written',
    ]);
  });

  it('with a repo: only links above the project root', () => {
    const warnings = loadProject(project(`${GUIDES}project: {repo: "https://github.com/o/r"}\n`, BODY)).warnings!;
    expect(warnings.map((w) => w.path)).toEqual(['body.line.8']);
  });
});
