/**
 * Tester suite for task_011 — `docsandeye diff` (AC3, AC4, AC5).
 *
 * Builds its own temporary git repositories (never the Generator's own
 * `fixtures/diff-repo` builder script, and never by calling into `../src/diff.ts`
 * to compute expectations): a component YAML at 1.0.0 with a committed binary
 * STL derived file (a 12-triangle cube written here with a small `Buffer`
 * routine), the STL edited and the version bumped to 1.3.0 in one commit, then
 * a media manifest pinned to 1.0.0. Every expected value (reasons, the exact
 * python argv, the summary line, exit codes) is copied verbatim from spec.md
 * and hardcoded here rather than imported from `../src/diff.ts`.
 *
 * Spawns the built `dist/bin.js` via `execFile`, exactly like `cli.test.ts`.
 */
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalJson } from '@docsandeye/core';

const execFileAsync = promisify(execFile);
const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binJs = path.join(cliDir, 'dist', 'bin.js');
const fakeBinDir = path.join(cliDir, 'fixtures', 'fake-bin');
const renderDir = path.resolve(cliDir, '../../render');

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const EXEC_TIMEOUT_MS = 120_000;
const EXEC_MAX_BUFFER = 16 * 1024 * 1024;

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function runCli(args: string[], env: Record<string, string | undefined>): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [binJs, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: EXEC_TIMEOUT_MS,
      maxBuffer: EXEC_MAX_BUFFER,
    });
    return { stdout, stderr, code: 0 };
  } catch (err: any) {
    const { stdout = '', stderr = '', status, code, signal } = err;
    const exitCode = typeof status === 'number' ? status : typeof code === 'number' ? code : 1;
    return { stdout, stderr, code: exitCode };
  }
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'docsandeye-diff-test-'));
}

function rmrf(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(root: string, rel: string, data: string | Buffer): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
}

// ---------------------------------------------------------------------------
// A small, independent binary-STL writer: an axis-aligned cube from the
// origin to (size, size, size), 12 triangles, matching the binary-STL layout
// `glb.read_binary_stl` expects (80-byte header, uint32 triangle count, then
// 50 bytes/triangle: 12 floats + a uint16 attribute byte count).
// ---------------------------------------------------------------------------

function cubeStl(size: number, header = 'docsandeye diff.test.ts fixture cube'): Buffer {
  const v: [number, number, number][] = [
    [0, 0, 0],
    [size, 0, 0],
    [size, size, 0],
    [0, size, 0],
    [0, 0, size],
    [size, 0, size],
    [size, size, size],
    [0, size, size],
  ];
  const faces: Array<{ normal: [number, number, number]; tris: [number, number, number][] }> = [
    { normal: [0, 0, -1], tris: [[0, 2, 1], [0, 3, 2]] },
    { normal: [0, 0, 1], tris: [[4, 5, 6], [4, 6, 7]] },
    { normal: [0, -1, 0], tris: [[0, 1, 5], [0, 5, 4]] },
    { normal: [1, 0, 0], tris: [[1, 2, 6], [1, 6, 5]] },
    { normal: [0, 1, 0], tris: [[2, 3, 7], [2, 7, 6]] },
    { normal: [-1, 0, 0], tris: [[3, 0, 4], [3, 4, 7]] },
  ];
  const triCount = 12;
  const buf = Buffer.alloc(80 + 4 + triCount * 50);
  buf.write(header, 0, 'ascii');
  buf.writeUInt32LE(triCount, 80);
  let offset = 84;
  for (const { normal, tris } of faces) {
    for (const tri of tris) {
      buf.writeFloatLE(normal[0], offset);
      buf.writeFloatLE(normal[1], offset + 4);
      buf.writeFloatLE(normal[2], offset + 8);
      offset += 12;
      for (const idx of tri) {
        const p = v[idx]!;
        buf.writeFloatLE(p[0], offset);
        buf.writeFloatLE(p[1], offset + 4);
        buf.writeFloatLE(p[2], offset + 8);
        offset += 12;
      }
      buf.writeUInt16LE(0, offset);
      offset += 2;
    }
  }
  return buf;
}

// A placeholder "GLB" (the CLI only ever copies a .glb candidate byte for
// byte; it is never parsed), just recognisable content per version.
function fakeGlb(tag: string): Buffer {
  return Buffer.from(`fake-glb:${tag}`, 'utf8');
}

// ---------------------------------------------------------------------------
// Git repo builder.
// ---------------------------------------------------------------------------

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'docsandeye-test',
  GIT_AUTHOR_EMAIL: 'docsandeye-test@example.com',
  GIT_COMMITTER_NAME: 'docsandeye-test',
  GIT_COMMITTER_EMAIL: 'docsandeye-test@example.com',
  GIT_CONFIG_NOSYSTEM: '1',
  HOME: os.tmpdir(),
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env: { ...process.env, ...GIT_ENV }, encoding: 'utf8' }).trim();
}

function commit(cwd: string, message: string): string {
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '--quiet', '--no-verify', '--no-gpg-sign', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

const CONFIG_YAML = 'guides:\n  - {id: aep, title: "AEP", base: /AEP}\n';

const STEP_MD = (media: string[]) => `---
id: step-01-fit
order: 1
title: Fit the top stop
guide: aep
parts:
  - {component: top-stop, qty: 2, cat: printed}
  - {component: no-geom, qty: 1, cat: printed}
  - {component: glb-part, qty: 1, cat: printed}
${media.length > 0 ? `media: [${media.join(', ')}]\n` : ''}---
Slide a top stop over each electrode.
`;

function componentYaml(opts: {
  id: string;
  name: string;
  version: string;
  master: string;
  sources: string[];
  derived?: string[];
  changelog?: Array<[string, string, string]>;
}): string {
  const lines = [
    `id: ${opts.id}`,
    `name: ${opts.name}`,
    'kind: printed',
    `design_version: ${opts.version}`,
    `master_format: ${opts.master}`,
    `source_files: ${JSON.stringify(opts.sources)}`,
  ];
  if (opts.derived && opts.derived.length > 0) lines.push(`derived_files: ${JSON.stringify(opts.derived)}`);
  if (opts.changelog && opts.changelog.length > 0) {
    lines.push('changelog:');
    for (const [ver, date, note] of opts.changelog) lines.push(`  - {version: ${ver}, date: ${date}, note: ${JSON.stringify(note)}}`);
  }
  return `${lines.join('\n')}\n`;
}

function mediaYaml(id: string, hero: string): string {
  return `id: ${id}\ntype: photo\nfile: assets/photo/${id}.jpg\nshot_date: 2026-02-15\nshot_by: "Example Maker"\nhero: [${hero}]\n`;
}

interface RepoShas {
  first: string;
  second: string;
  third: string;
  firstStl: Buffer;
  firstGlb: Buffer;
}

/**
 * Three-commit history:
 *   first  — top-stop@1.0.0 (derived TopStop.stl, a 12-triangle cube of side
 *            10); no-geom@1.0.0 (no derived files); glb-part@1.0.0 (derived
 *            GlbPart.glb).
 *   second — TopStop.stl edited (cube of side 12) AND top-stop bumped to
 *            1.3.0, in the SAME commit; no-geom bumped to 1.1.0; glb-part
 *            bumped to 1.1.0 with new bytes.
 *   third  — four STALE media: vid-01-old (top-stop@1.0.0, the main path),
 *            vid-02-nogeom (no-geom@1.0.0, no candidate), vid-03-never
 *            (top-stop@0.9.0, a version never committed), vid-04-glb
 *            (glb-part@1.0.0, a .glb candidate copied without python).
 */
function buildRepo(dir: string): RepoShas {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '--quiet', '--initial-branch=main');

  writeFile(dir, 'docsandeye.config.yaml', CONFIG_YAML);
  writeFile(
    dir,
    'docs/components/top-stop.yaml',
    componentYaml({
      id: 'top-stop',
      name: 'Top Stop',
      version: '1.0.0',
      master: 'scad',
      sources: ['Components/TopStop/TopStop.scad'],
      derived: ['Components/TopStop/TopStop.stl'],
      changelog: [['1.0.0', '2026-01-10', 'Initial release.']],
    }),
  );
  writeFile(dir, 'Components/TopStop/TopStop.scad', 'cube(10);\n');
  const firstStl = cubeStl(10);
  writeFile(dir, 'Components/TopStop/TopStop.stl', firstStl);

  writeFile(
    dir,
    'docs/components/no-geom.yaml',
    componentYaml({ id: 'no-geom', name: 'No Geometry', version: '1.0.0', master: 'scad', sources: ['Components/NoGeom/NoGeom.scad'] }),
  );
  writeFile(dir, 'Components/NoGeom/NoGeom.scad', 'sphere(5);\n');

  writeFile(
    dir,
    'docs/components/glb-part.yaml',
    componentYaml({
      id: 'glb-part',
      name: 'GLB Part',
      version: '1.0.0',
      master: 'f3z',
      sources: ['Components/GlbPart/GlbPart.f3z'],
      derived: ['Components/GlbPart/GlbPart.glb'],
    }),
  );
  writeFile(dir, 'Components/GlbPart/GlbPart.f3z', 'f3z placeholder\n');
  const firstGlb = fakeGlb('glb-part 1.0.0');
  writeFile(dir, 'Components/GlbPart/GlbPart.glb', firstGlb);

  writeFile(dir, 'docs/steps/step-01-fit.md', STEP_MD([]));
  const first = commit(dir, 'Add components at 1.0.0');

  writeFile(dir, 'Components/TopStop/TopStop.scad', 'cube(12);\n');
  writeFile(dir, 'Components/TopStop/TopStop.stl', cubeStl(12));
  writeFile(
    dir,
    'docs/components/top-stop.yaml',
    componentYaml({
      id: 'top-stop',
      name: 'Top Stop',
      version: '1.3.0',
      master: 'scad',
      sources: ['Components/TopStop/TopStop.scad'],
      derived: ['Components/TopStop/TopStop.stl'],
      changelog: [
        ['1.0.0', '2026-01-10', 'Initial release.'],
        ['1.3.0', '2026-03-01', 'Chamfer on electrode bore.'],
      ],
    }),
  );
  writeFile(
    dir,
    'docs/components/no-geom.yaml',
    componentYaml({ id: 'no-geom', name: 'No Geometry', version: '1.1.0', master: 'scad', sources: ['Components/NoGeom/NoGeom.scad'] }),
  );
  writeFile(
    dir,
    'docs/components/glb-part.yaml',
    componentYaml({
      id: 'glb-part',
      name: 'GLB Part',
      version: '1.1.0',
      master: 'f3z',
      sources: ['Components/GlbPart/GlbPart.f3z'],
      derived: ['Components/GlbPart/GlbPart.glb'],
    }),
  );
  writeFile(dir, 'Components/GlbPart/GlbPart.glb', fakeGlb('glb-part 1.1.0'));
  const second = commit(dir, 'Bump versions (top-stop 1.3.0, no-geom 1.1.0, glb-part 1.1.0)');

  writeFile(dir, 'docs/media/vid-01-old.yaml', mediaYaml('vid-01-old', 'top-stop@1.0.0'));
  writeFile(dir, 'docs/media/vid-02-nogeom.yaml', mediaYaml('vid-02-nogeom', 'no-geom@1.0.0'));
  writeFile(dir, 'docs/media/vid-03-never.yaml', mediaYaml('vid-03-never', 'top-stop@0.9.0'));
  writeFile(dir, 'docs/media/vid-04-glb.yaml', mediaYaml('vid-04-glb', 'glb-part@1.0.0'));
  writeFile(dir, 'docs/steps/step-01-fit.md', STEP_MD(['vid-01-old', 'vid-02-nogeom', 'vid-03-never', 'vid-04-glb']));
  const third = commit(dir, 'Add stale media');

  return { first, second, third, firstStl, firstGlb };
}

function oldRenderPath(root: string, rel: string): string {
  return path.join(root, 'build', 'render', 'old', rel);
}

function readManifest(root: string): any {
  return JSON.parse(fs.readFileSync(oldRenderPath(root, 'manifest.json'), 'utf8'));
}

// ---------------------------------------------------------------------------
// AC3 + AC4 + AC5: one shared repo, driven through several sequential
// `docsandeye diff` invocations (fresh -> cached -> --force -> forced failure).
// ---------------------------------------------------------------------------

describe('AC3/AC4/AC5: docsandeye diff — real git, fake python3', () => {
  let root: string;
  let shas: RepoShas;
  let log1: string;

  beforeEach(() => {
    root = tempDir();
    shas = buildRepo(root);
    log1 = path.join(root, 'python.log');
  });

  afterEach(() => {
    rmrf(root);
  });

  it('first run: restores top-stop@1.0.0 (bytes, commit, source), copies glb-part with no python call, skips the rest, summary and exit 0', async () => {
    const result = await runCli(['diff', '--project', root], {
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
      DOCSI_FAKE_PYTHON_LOG: log1,
      DOCSANDEYE_RENDER_PYTHONPATH: renderDir,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('restored 2, cached 0, skipped 2, failed 0\n');

    // Restored STL bytes equal the FIRST commit's STL exactly.
    const restoredStl = fs.readFileSync(oldRenderPath(root, 'top-stop@1.0.0.stl'));
    expect(restoredStl.equals(shas.firstStl)).toBe(true);

    // Exactly one python invocation (top-stop's .stl conversion); glb-part's
    // .glb candidate is copied, never handed to python.
    const logLines = fs.readFileSync(log1, 'utf8').trim().split('\n');
    expect(logLines.length).toBe(1);
    const entry = JSON.parse(logLines[0]!);
    expect(entry.argv).toEqual([
      '-m',
      'docsandeye_render',
      'glb',
      'build/render/old/top-stop@1.0.0.stl',
      'build/render/old/top-stop@1.0.0.glb',
    ]);
    expect(entry.cwd).toBe(root);

    // glb-part's restored bytes are the FIRST commit's glb bytes, copied verbatim.
    const restoredGlb = fs.readFileSync(oldRenderPath(root, 'glb-part@1.0.0.glb'));
    expect(restoredGlb.equals(shas.firstGlb)).toBe(true);

    const manifest = readManifest(root);
    const expected = canonicalJson({
      version: 1,
      jobs: {
        'top-stop@1.0.0': {
          status: 'restored',
          commit: shas.first,
          source: 'Components/TopStop/TopStop.stl',
          output: 'build/render/old/top-stop@1.0.0.glb',
        },
        'no-geom@1.0.0': { status: 'skipped', output: 'build/render/old/no-geom@1.0.0.glb', reason: 'no derived .glb or .stl' },
        'top-stop@0.9.0': {
          status: 'skipped',
          output: 'build/render/old/top-stop@0.9.0.glb',
          reason: 'no commit with design_version 0.9.0',
        },
        'glb-part@1.0.0': {
          status: 'restored',
          commit: shas.first,
          source: 'Components/GlbPart/GlbPart.glb',
          output: 'build/render/old/glb-part@1.0.0.glb',
        },
      },
    });
    expect(manifest).toBeTruthy();
    expect(fs.readFileSync(oldRenderPath(root, 'manifest.json'), 'utf8')).toBe(`${expected}\n`);
  });

  // The fake python3 is a no-op stub (it only logs argv; it never writes the
  // .glb the cache check looks for on disk), so the cache/--force behaviour
  // for the .stl-conversion job can only be observed truthfully with the
  // REAL python3 actually producing that file. glb-part's copy path writes
  // real bytes either way, so both jobs are meaningfully covered here.
  it('second run (no --force, real python3): both restored jobs become cached; skipped jobs stay skipped', async () => {
    await runCli(['diff', '--project', root], { DOCSANDEYE_RENDER_PYTHONPATH: renderDir });

    const second = await runCli(['diff', '--project', root], { DOCSANDEYE_RENDER_PYTHONPATH: renderDir });

    expect(second.code).toBe(0);
    expect(second.stdout).toBe('restored 0, cached 2, skipped 2, failed 0\n');

    const manifest = readManifest(root);
    expect(manifest.jobs['top-stop@1.0.0'].status).toBe('cached');
    expect(manifest.jobs['top-stop@1.0.0'].commit).toBe(shas.first);
    expect(manifest.jobs['glb-part@1.0.0'].status).toBe('cached');
  });

  it('--force restores again (real python3) even though the output and commit are unchanged', async () => {
    await runCli(['diff', '--project', root], { DOCSANDEYE_RENDER_PYTHONPATH: renderDir });

    const forced = await runCli(['diff', '--project', root, '--force'], { DOCSANDEYE_RENDER_PYTHONPATH: renderDir });

    expect(forced.code).toBe(0);
    expect(forced.stdout).toBe('restored 2, cached 0, skipped 2, failed 0\n');
    const manifest = readManifest(root);
    expect(manifest.jobs['top-stop@1.0.0'].status).toBe('restored');
    expect(manifest.jobs['glb-part@1.0.0'].status).toBe('restored');
  });

  it('a failing python3 marks that job failed, exits 1, and the summary/reason are exact', async () => {
    const log4 = path.join(root, 'python4-fail.log');
    const result = await runCli(['diff', '--project', root, '--force'], {
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
      DOCSI_FAKE_PYTHON_LOG: log4,
      DOCSANDEYE_RENDER_PYTHONPATH: renderDir,
      DOCSI_FAKE_PYTHON_EXIT: '7',
    });

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('restored 1, cached 0, skipped 2, failed 1\n');
    expect(result.stderr).toContain('top-stop@1.0.0: python3 exited 7');

    const manifest = readManifest(root);
    expect(manifest.jobs['top-stop@1.0.0'].status).toBe('failed');
    expect(manifest.jobs['top-stop@1.0.0'].reason).toBe('python3 exited 7');
    expect(manifest.jobs['top-stop@1.0.0'].commit).toBe(shas.first);
    // glb-part never touches python, so it is unaffected by the fake failure.
    expect(manifest.jobs['glb-part@1.0.0'].status).toBe('restored');
  });
});

// ---------------------------------------------------------------------------
// AC3: real python3 (no fake-bin), asserting the actual GLB header.
// ---------------------------------------------------------------------------

describe('AC3: docsandeye diff with the real python3', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir();
    buildRepo(root);
  });

  afterEach(() => {
    rmrf(root);
  });

  it('produces a real GLB (magic "glTF") for top-stop@1.0.0 via the real python3', async () => {
    const result = await runCli(['diff', '--project', root], {
      DOCSANDEYE_RENDER_PYTHONPATH: renderDir,
    });

    expect(result.code).toBe(0);
    const glbPath = oldRenderPath(root, 'top-stop@1.0.0.glb');
    expect(fs.existsSync(glbPath)).toBe(true);
    const bytes = fs.readFileSync(glbPath);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('glTF');
  });
});

// ---------------------------------------------------------------------------
// AC4: non-git directory — every job skipped, exit 0.
// ---------------------------------------------------------------------------

describe('AC4: docsandeye diff outside a git repository', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir();
    writeFile(root, 'docsandeye.config.yaml', CONFIG_YAML);
    writeFile(
      root,
      'docs/components/top-stop.yaml',
      componentYaml({
        id: 'top-stop',
        name: 'Top Stop',
        version: '1.3.0',
        master: 'scad',
        sources: ['Components/TopStop/TopStop.scad'],
        derived: ['Components/TopStop/TopStop.stl'],
      }),
    );
    writeFile(root, 'Components/TopStop/TopStop.scad', 'cube(12);\n');
    writeFile(root, 'Components/TopStop/TopStop.stl', cubeStl(12));
    writeFile(root, 'docs/media/vid-01-old.yaml', mediaYaml('vid-01-old', 'top-stop@1.0.0'));
    writeFile(
      root,
      'docs/steps/step-01-fit.md',
      `---\nid: step-01-fit\norder: 1\ntitle: Fit the top stop\nguide: aep\nparts:\n  - {component: top-stop, qty: 1, cat: printed}\nmedia: [vid-01-old]\n---\nFit it.\n`,
    );
    // Deliberately no `git init`.
  });

  afterEach(() => {
    rmrf(root);
  });

  it('every job is skipped with reason "not a git repository", exit 0', async () => {
    const result = await runCli(['diff', '--project', root], {
      DOCSANDEYE_RENDER_PYTHONPATH: renderDir,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('restored 0, cached 0, skipped 1, failed 0\n');

    const manifest = readManifest(root);
    expect(manifest.jobs['top-stop@1.0.0'].status).toBe('skipped');
    expect(manifest.jobs['top-stop@1.0.0'].reason).toBe('not a git repository');
    expect(manifest.jobs['top-stop@1.0.0'].commit).toBeUndefined();
  });
});
