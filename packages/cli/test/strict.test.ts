/**
 * Tester suite — task_008 AC8 ("Strict by default, budget lines only").
 *
 * `docsandeye check --dist` promotes ONLY over-budget lines
 * (`budget: <page> <kb> KB > <limit> KB`) to errors by default; every other
 * warning line (the version-bump guard's informational lines, and the
 * budget walker's "missing asset" lines) stays a warning. `--no-strict`
 * restores the v0.1 behaviour (nothing promoted); `--strict` is accepted as
 * a no-op (identical to the default).
 *
 * Independence note: the expected `errors:`/`warnings:` counts below are
 * computed by hand from `packages/cli/fixtures/dist`'s actual files and
 * `packages/cli/fixtures/project`'s config, applying the promotion rule
 * from spec.md — never by running `docsandeye check` and reading back
 * whatever it printed. The fixture project is a fresh, non-git temp copy,
 * so the version-bump guard's "not a git repository" line is always one of
 * the warnings (verified directly against `git rev-parse
 * --is-inside-work-tree` in a scratch tmp dir, independent of this CLI):
 *
 *   fixtures/dist/AEP/step-01-a/index.html: 1128 B
 *   + _astro/site.css (1128+5000)                  linked <link rel=stylesheet>
 *   + _astro/entry.js (+1500)                       <link rel=modulepreload>
 *   + _astro/app.js (+3000)                         <script type=module src>
 *   + _docsandeye/img/a-800.png (+1200)             largest of the srcset pair (600/1200)
 *   + _docsandeye/video/v1.jpg (+400)               video[poster] (video src itself is NOT counted)
 *   = 12228 B = 12 KB (Math.round) > byte_budget_kb: 10 -> one over-budget warning
 *   + _astro/missing.css does not exist             -> one "missing asset" warning
 *   fixtures/dist/AEP/step-02-b/index.html: 436 + site.css(5000) + local.js(300)
 *     + max(pic-1x 350, pic-2x 700) + pic.png(500) = 6936 B = 6.78 KB, under budget, nothing missing
 *
 * So `check --project <fresh temp copy of fixtures/project> --dist
 * fixtures/dist` always produces exactly 3 warning lines pre-promotion:
 *   1. guard: not a git repository, version-bump guard skipped   (informational, never promoted)
 *   2. budget: /AEP/step-01-a/ missing asset /_astro/missing.css (informational, never promoted)
 *   3. budget: /AEP/step-01-a/ 12 KB > 10 KB                     (the ONLY promotable line)
 *
 * Strict (default, and `--strict`): errors: 1, warnings: 2 (lines 1+2 stay warnings, line 3 promoted).
 * `--no-strict`: errors: 0, warnings: 3 (nothing promoted — the v0.1 behaviour).
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { isOverBudgetLine, OVER_BUDGET_RE } from '../src/check.ts';

const execFileAsync = promisify(execFile);
const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binJs = path.join(cliDir, 'dist', 'bin.js');
const fixturesDir = path.join(cliDir, 'fixtures');
const projectFixture = path.join(fixturesDir, 'project');
const distFixture = path.join(fixturesDir, 'dist');

// Spawning `node dist/bin.js` per test; see cli.test.ts's identical note on
// why the timeouts are raised (concurrent astro builds elsewhere in the
// workspace can starve the CPU past vitest's 5s default).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const CLI_EXEC_TIMEOUT_MS = 120_000;
const CLI_EXEC_MAX_BUFFER = 16 * 1024 * 1024;

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function runCli(args: string[], env?: Record<string, string>): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [binJs, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: CLI_EXEC_TIMEOUT_MS,
      maxBuffer: CLI_EXEC_MAX_BUFFER,
    });
    return { stdout, stderr, code: 0 };
  } catch (err: any) {
    const { stdout = '', stderr = '', status, code } = err;
    const exitCode = typeof status === 'number' ? status : typeof code === 'number' ? code : 1;
    return { stdout, stderr, code: exitCode };
  }
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'docsandeye-strict-test-'));
}

function rmrf(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    if (fs.statSync(srcPath).isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function lastLine(stdout: string): string {
  const lines = stdout.split('\n').filter((l) => l.trim());
  return lines[lines.length - 1] ?? '';
}

describe('AC8: OVER_BUDGET_RE / isOverBudgetLine — the exact promotion rule (pure, no build)', () => {
  it('matches an over-budget line', () => {
    expect(isOverBudgetLine('budget: /AEP/step-01-a/ 12 KB > 10 KB')).toBe(true);
    expect(OVER_BUDGET_RE.test('budget: /AEP/step-01-a/ 12 KB > 10 KB')).toBe(true);
  });

  it('does not match a missing-asset line', () => {
    expect(isOverBudgetLine('budget: /AEP/step-01-a/ missing asset /_astro/missing.css')).toBe(false);
  });

  it('does not match a guard line', () => {
    expect(isOverBudgetLine('guard: not a git repository, version-bump guard skipped')).toBe(false);
    expect(isOverBudgetLine('guard: vial-cap: no git history for its source files')).toBe(false);
  });

  it('does not match a version-bump violation line', () => {
    expect(isOverBudgetLine('guard: vial-cap: source changed in 1234567 but design_version is still 1.0.0')).toBe(false);
  });
});

describe('AC8: check --dist is strict by default — only the over-budget line is promoted', () => {
  let tmpProject: string;

  beforeEach(() => {
    tmpProject = tempDir();
    copyDir(projectFixture, tmpProject);
  });

  afterEach(() => {
    rmrf(tmpProject);
  });

  it('default mode (no flag): exit 1, "errors: 1, warnings: 2"; the informational lines stay in stderr as warnings', async () => {
    const result = await runCli(['check', '--project', tmpProject, '--dist', distFixture]);

    expect(result.code).toBe(1);
    expect(lastLine(result.stdout)).toBe('errors: 1, warnings: 2');

    // All three source lines are still printed (as errors or warnings; check.ts
    // sends both to stderr) — nothing silently disappears under strict mode.
    expect(result.stderr).toContain('guard: not a git repository, version-bump guard skipped');
    expect(result.stderr).toContain('budget: /AEP/step-01-a/ missing asset /_astro/missing.css');
    expect(result.stderr).toContain('budget: /AEP/step-01-a/ 12 KB > 10 KB');
  });

  it('--strict is accepted as a no-op: identical result to the default', async () => {
    const result = await runCli(['check', '--project', tmpProject, '--dist', distFixture, '--strict']);

    expect(result.code).toBe(1);
    expect(lastLine(result.stdout)).toBe('errors: 1, warnings: 2');
  });

  it('--no-strict restores the v0.1 behaviour: exit 0, "errors: 0, warnings: 3", nothing promoted', async () => {
    const result = await runCli(['check', '--project', tmpProject, '--dist', distFixture, '--no-strict']);

    expect(result.code).toBe(0);
    expect(lastLine(result.stdout)).toBe('errors: 0, warnings: 3');

    expect(result.stderr).toContain('guard: not a git repository, version-bump guard skipped');
    expect(result.stderr).toContain('budget: /AEP/step-01-a/ missing asset /_astro/missing.css');
    expect(result.stderr).toContain('budget: /AEP/step-01-a/ 12 KB > 10 KB');
  });

  it('without --dist, strict mode has nothing to promote: exit 0, "errors: 0" (unaffected by strict/no-strict)', async () => {
    const withStrict = await runCli(['check', '--project', tmpProject]);
    const withNoStrict = await runCli(['check', '--project', tmpProject, '--no-strict']);

    expect(withStrict.code).toBe(0);
    expect(lastLine(withStrict.stdout)).toMatch(/^errors: 0/);
    expect(withNoStrict.code).toBe(0);
    expect(lastLine(withNoStrict.stdout)).toMatch(/^errors: 0/);
  });

  it('--help usage text documents --no-strict and --strict', async () => {
    const result = await runCli(['check', '--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--no-strict');
    expect(result.stdout).toContain('--strict');
  });
});
