// @ts-check
/**
 * Builds the reader-mode interactive fixture site
 * (`fixtures/site-interactive`) into `dist-e2e/` for the end-to-end suite.
 * NODE_ENV is forced to production: a build under a test runner otherwise
 * renders Starlight's development search placeholder instead of Pagefind.
 * With `E2E_DIST` set the suite runs against that built site: nothing to build.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

if (process.env.E2E_DIST) {
  console.log(`E2E_DIST=${process.env.E2E_DIST}: skipping the fixture build`);
  process.exit(0);
}

const site = path.resolve(import.meta.dirname, '../fixtures/site-interactive');
/** @type {NodeJS.ProcessEnv} */
const env = { ...process.env, NODE_ENV: 'production' };
delete env.DOCSANDEYE_MAINTAINER;
execFileSync('npx', ['astro', 'build', '--outDir', './dist-e2e'], { cwd: site, env, stdio: 'inherit', shell: process.platform === 'win32' });
