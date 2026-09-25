// @ts-check
/**
 * Builds the reader-mode interactive fixture site
 * (`fixtures/site-interactive`) into `dist-e2e/` for the end-to-end suite.
 * NODE_ENV is forced to production: a build under a test runner otherwise
 * renders Starlight's development search placeholder instead of Pagefind.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const site = path.resolve(import.meta.dirname, '../fixtures/site-interactive');
/** @type {NodeJS.ProcessEnv} */
const env = { ...process.env, NODE_ENV: 'production' };
delete env.DOCSANDEYE_MAINTAINER;
execFileSync('npx', ['astro', 'build', '--outDir', './dist-e2e'], { cwd: site, env, stdio: 'inherit', shell: process.platform === 'win32' });
