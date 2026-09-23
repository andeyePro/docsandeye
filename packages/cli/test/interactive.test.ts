/**
 * task_020 — `docsandeye check` reports the reader-interactive schema
 * problems (a `when` naming an unknown profile id) and body `when` comment
 * problems (nested, unclosed) with file and path.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docsandeye-interactive-'));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

async function check(root: string): Promise<{ code: number; err: string[]; out: string[] }> {
  const err: string[] = [];
  const out: string[] = [];
  const code = await runCheck({ root, strict: true }, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, err, out };
}

const CONFIG = `guides:\n  - {id: g, title: G, base: /g}\nprofile:\n  - {id: temp-kit, type: boolean, label: "Temperature kit?"}\n`;

describe('check: interactive problems', () => {
  it('a valid interactive project has no errors', async () => {
    const root = project({
      'docsandeye.config.yaml': CONFIG,
      'docs/steps/s1.md': `---\nid: s1\norder: 1\ntitle: One\nwhen: {temp-kit: true}\n---\n<!-- when temp-kit=true -->\nA\n<!-- /when -->\n`,
    });
    const { code, err } = await check(root);
    expect(err.filter((l) => !l.startsWith('guard:'))).toEqual([]);
    expect(code).toBe(0);
  });

  it('reports a when naming an unknown profile id at its path', async () => {
    const root = project({
      'docsandeye.config.yaml': CONFIG,
      'docs/steps/s1.md': `---\nid: s1\norder: 1\ntitle: One\nwhen: {nope: true}\n---\n`,
    });
    const { code, err } = await check(root);
    expect(code).toBe(1);
    expect(err).toContain('docs/steps/s1.md:when.nope: schema: unknown profile id "nope" (profile ids: temp-kit)');
  });

  it('reports nested and unclosed body when comments with file line numbers', async () => {
    const root = project({
      'docsandeye.config.yaml': CONFIG,
      'docs/steps/s1.md': `---\nid: s1\norder: 1\ntitle: One\n---\n<!-- when temp-kit=true -->\nA\n<!-- when temp-kit=false -->\n`,
    });
    const { code, err } = await check(root);
    expect(code).toBe(1);
    expect(err.some((l) => l.startsWith('docs/steps/s1.md:body.line.8: schema: line 8: nested'))).toBe(true);
    expect(err.some((l) => l.startsWith('docs/steps/s1.md:body.line.6: schema: line 6:') && l.includes('never closed'))).toBe(true);
  });
});
