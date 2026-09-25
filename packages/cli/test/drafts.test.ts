/**
 * Draft markers in a built site (`src/drafts.ts`) and the unmentioned-part
 * warning, through `docsandeye check`. The `dist-drafts` fixture holds a
 * guide page with an escaped `<!-- TODO` in a code block, a step page with
 * two `DRAFT:` lines, and a page that is neither (never checked); script and
 * style bodies, attributes and real comments carry markers that must not count.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parse } from 'node-html-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftErrors, draftMarkers, visibleLines } from '../src/drafts.ts';

const execFileAsync = promisify(execFile);
const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binJs = path.join(cliDir, 'dist', 'bin.js');
const projectFixture = path.join(cliDir, 'fixtures', 'project');
const draftsDist = path.join(cliDir, 'fixtures', 'dist-drafts');

// Spawning `node dist/bin.js`; see cli.test.ts on the raised timeouts.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [binJs, ...args], { encoding: 'utf8', timeout: 120_000 });
    return { stdout, stderr, code: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: typeof err.code === 'number' ? err.code : 1 };
  }
}

describe('visibleLines', () => {
  it('gives one line per block, drops scripts, styles, comments and attributes, decodes entities', () => {
    const html = '<body><script>x</script><style>y</style><!-- c --><p title="t">One <em>two</em><br>three &lt;b&gt;</p><li>four</li></body>';
    expect(visibleLines(parse(html, { comment: false }))).toEqual(['One two', 'three <b>', 'four']);
  });
});

describe('draftMarkers', () => {
  it('finds a literal "<!-- TODO" in reader text and lines starting "DRAFT:"', () => {
    expect(draftMarkers('<pre><code>&lt;!-- TODO: fix --&gt;</code></pre><p>DRAFT: not final</p>')).toEqual([
      'contains "<!-- TODO": <!-- TODO: fix -->',
      'line starts "DRAFT:": DRAFT: not final',
    ]);
  });

  it('ignores comments, attributes, script and style bodies, and DRAFT: mid-line', () => {
    const html = '<!-- TODO real --><p data-x="DRAFT: a" title="<!-- TODO">Text, then DRAFT: here</p><script>"<!-- TODO"</script><style>/* DRAFT: */</style>';
    expect(draftMarkers(html)).toEqual([]);
  });

  it('cuts a long excerpt to 60 characters', () => {
    const [line] = draftMarkers(`<p>DRAFT: ${'x'.repeat(100)}</p>`);
    expect(line!.slice('line starts "DRAFT:": '.length)).toHaveLength(60);
  });
});

describe('draftErrors over a dist directory', () => {
  it('checks guide and step pages only', () => {
    expect(draftErrors(draftsDist)).toEqual([
      'draft: /kit/ contains "<!-- TODO": <!-- TODO: explain the jumper -->',
      'draft: /kit/step-01-a/ line starts "DRAFT:": DRAFT: check this torque value with the maintainer',
      'draft: /kit/step-01-a/ line starts "DRAFT:": DRAFT: second line of a paragraph',
    ]);
  });
});

describe('docsandeye check', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docsandeye-drafts-test-'));
    fs.cpSync(projectFixture, tmp, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('--dist reports draft markers as errors', async () => {
    const result = await runCli(['check', '--project', tmp, '--dist', draftsDist]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('draft: /kit/ contains "<!-- TODO"');
    expect(result.stderr).toContain('draft: /kit/step-01-a/ line starts "DRAFT:"');
    expect(result.stderr).not.toContain('/about/');
    expect(result.stdout.trim().split('\n').at(-1)).toBe('errors: 3, warnings: 1');
  });

  it('warns about a part the step body never mentions, without --dist', async () => {
    const stepFile = path.join(tmp, 'docs', 'steps', 'step-02-fit-cap.md');
    fs.writeFileSync(stepFile, fs.readFileSync(stepFile, 'utf8').replace('onto the Glass Vial 20 mL', 'on'));
    const result = await runCli(['check', '--project', tmp]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain('warning: docs/steps/step-02-fit-cap.md:parts.0.component: schema: part "Glass Vial 20 mL" (glass-vial) is never mentioned in the step body');
    // The cap is `cat: prev` on this step: exempt.
    expect(result.stderr).not.toContain('parts.1.component');
    expect(result.stdout.trim().split('\n').at(-1)).toBe('errors: 0, warnings: 2');
  });
});
