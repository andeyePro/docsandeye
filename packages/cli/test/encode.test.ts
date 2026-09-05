import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runEncode, encodeArgs, MEDIA_PLAN_PATH, MEDIA_OUT_PATH } from '../src/encode.js';
import { EXIT } from '../src/common.js';
import { join } from 'node:path';
import { rmSync, mkdtempSync, readFileSync, existsSync } from 'node:fs';

const fixturesDir = join(import.meta.dirname, '../fixtures');

// Mock IO for capturing output
class MockIo {
  logs: string[] = [];
  errs: string[] = [];

  log(msg: string) {
    this.logs.push(msg);
  }

  err(msg: string) {
    this.errs.push(msg);
  }
}

// AC10: CLI encode command
describe('AC10: CLI encode command', () => {
  let tmpdir: string;

  beforeEach(() => {
    tmpdir = mkdtempSync(join(import.meta.dirname, '..', '.test-'));
  });

  afterEach(() => {
    if (tmpdir) {
      rmSync(tmpdir, { recursive: true, force: true });
    }
  });

  it('encodeArgs produces correct argv', () => {
    const args = encodeArgs({ force: false, allowMissing: false });
    expect(args).toEqual([
      '-m', 'docsandeye_render', 'encode',
      '--plan', MEDIA_PLAN_PATH,
      '--out', MEDIA_OUT_PATH,
      '--project-root', '.',
    ]);
  });

  it('encodeArgs adds --force when requested', () => {
    const args = encodeArgs({ force: true, allowMissing: false });
    expect(args).toContain('--force');
    const forceIdx = args.indexOf('--force');
    expect(forceIdx).toBeGreaterThan(args.indexOf('--out'));
  });

  it('encodeArgs adds --allow-missing when requested', () => {
    const args = encodeArgs({ force: false, allowMissing: true });
    expect(args).toContain('--allow-missing');
    const allowIdx = args.indexOf('--allow-missing');
    expect(allowIdx).toBeGreaterThan(args.indexOf('--out'));
  });

  it('encodeArgs adds both flags in correct order', () => {
    const args = encodeArgs({ force: true, allowMissing: true });
    const forceIdx = args.indexOf('--force');
    const allowIdx = args.indexOf('--allow-missing');
    expect(forceIdx).toBeLessThan(allowIdx);
  });

  it('runEncode with invalid project reports problems', async () => {
    const io = new MockIo();
    const code = await runEncode({ root: tmpdir, force: false, allowMissing: false }, io as any);
    expect(code).toBe(EXIT.PROBLEMS);
    expect(io.errs.length).toBeGreaterThan(0);
  });

  it('runEncode with no project reports problems', async () => {
    const io = new MockIo();
    const code = await runEncode(
      { root: '/nonexistent/path/that/does/not/exist', force: false, allowMissing: false },
      io as any
    );
    // A non-existent directory is treated as having no config, returning PROBLEMS exit code
    expect(code).toBe(EXIT.PROBLEMS);
  });

  it('MEDIA_PLAN_PATH points to build/media-plan.json', () => {
    expect(MEDIA_PLAN_PATH).toBe('build/media-plan.json');
  });

  it('MEDIA_OUT_PATH points to build/media', () => {
    expect(MEDIA_OUT_PATH).toBe('build/media');
  });
});
