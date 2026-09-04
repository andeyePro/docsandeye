#!/usr/bin/env node
/**
 * `docsandeye` entry point: argv parsing with `node:util` `parseArgs`,
 * dispatch to init / render / check, exit codes 0/1/2/64/65/66.
 */
import { parseArgs } from 'node:util';
import { KEBAB_ID_RE } from '@docsandeye/core';
import { runCheck } from './check.js';
import { EXIT, processIo, type Io } from './common.js';
import { runInit } from './init.js';
import { findProjectRoot, packageVersion } from './paths.js';
import { runRender } from './render.js';
import path from 'node:path';

export const USAGE = `Usage: docsandeye <command> [options]

Commands:
  init <dir>   scaffold a Starlight site wired to the starlight-docsandeye plugin
  render       write build/render-plan.json and run the Python render pipeline
  check        validate content, guard version bumps, measure page byte budgets

Options:
  -h, --help     show this help
  -V, --version  print the package version

Exit codes:
  0 ok · 1 problems reported · 2 render pipeline unavailable · 64 usage error
  65 refused to overwrite an existing project · 66 no project found`;

export const INIT_USAGE = `Usage: docsandeye init <dir> [--guide <id>] [--title <text>] [--force]

Create a Docs&I project (Starlight site + example content) in <dir>.

Options:
  --guide <id>    kebab-case guide id (default: main)
  --title <text>  guide title (default: Hardware Guide)
  --force         overwrite the files the template writes; other files are left alone
  -h, --help      show this help`;

export const RENDER_USAGE = `Usage: docsandeye render [--project <root>] [--force] [--allow-missing]

Write <root>/build/render-plan.json and run python3 -m docsandeye_render on it.

Options:
  --project <root>  project root (default: nearest directory with docsandeye.config.yaml)
  --force           re-render every job, ignoring the cache
  --allow-missing   skip jobs whose render tool is not installed instead of failing
  -h, --help        show this help`;

export const CHECK_USAGE = `Usage: docsandeye check [--project <root>] [--dist <dir>] [--strict]

Validate content, run the version-bump guard against git history and, with
--dist, measure each step page's initial-load bytes and CO2e estimate.

Options:
  --project <root>  project root (default: nearest directory with docsandeye.config.yaml)
  --dist <dir>      built site to measure; writes <root>/build/carbon.json
  --strict          treat warnings as errors
  -h, --help        show this help`;

export const NO_PROJECT_MESSAGE = 'no docsandeye.config.yaml found (run docsandeye init)';

interface OptionSpec {
  type: 'string' | 'boolean';
  short?: string;
  default?: string | boolean;
}

interface SubArgs {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
}

const HELP_OPTION: OptionSpec = { type: 'boolean', short: 'h', default: false };

/** Strict `parseArgs` over a subcommand's options; usage errors return 64, `--help` prints usage and returns 0. */
function parseSub(cmd: string, usage: string, args: string[], options: Record<string, OptionSpec>, io: Io): SubArgs | number {
  let parsed: SubArgs;
  try {
    const result = parseArgs({ args, options: { ...options, help: HELP_OPTION }, strict: true, allowPositionals: true });
    parsed = { values: result.values as SubArgs['values'], positionals: result.positionals };
  } catch (err) {
    io.err(`docsandeye ${cmd}: ${(err as Error).message}`);
    io.err('');
    io.err(usage);
    return EXIT.USAGE;
  }
  if (parsed.values.help === true) {
    io.out(usage);
    return EXIT.OK;
  }
  return parsed;
}

/** `--project` if given, else discovery from cwd; undefined after printing the 66 message. */
function resolveRoot(project: string | undefined, io: Io): string | undefined {
  if (project !== undefined) return path.resolve(project);
  const root = findProjectRoot(process.cwd());
  if (root === undefined) io.err(NO_PROJECT_MESSAGE);
  return root;
}

export async function main(argv: string[], io: Io = processIo): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined) {
    io.err(USAGE);
    return EXIT.USAGE;
  }
  if (command === '--help' || command === '-h') {
    io.out(USAGE);
    return EXIT.OK;
  }
  if (command === '--version' || command === '-V') {
    io.out(packageVersion());
    return EXIT.OK;
  }

  switch (command) {
    case 'init': {
      const parsed = parseSub('init', INIT_USAGE, rest, {
        guide: { type: 'string', default: 'main' },
        title: { type: 'string', default: 'Hardware Guide' },
        force: { type: 'boolean', default: false },
      }, io);
      if (typeof parsed === 'number') return parsed;
      const dir = parsed.positionals[0];
      if (dir === undefined || parsed.positionals.length !== 1) {
        io.err('docsandeye init: expected exactly one <dir>');
        io.err('');
        io.err(INIT_USAGE);
        return EXIT.USAGE;
      }
      const guide = parsed.values.guide as string;
      if (!KEBAB_ID_RE.test(guide)) {
        io.err(`docsandeye init: --guide must be a kebab-case id, got "${guide}"`);
        return EXIT.USAGE;
      }
      return runInit({ dir, guide, title: parsed.values.title as string, force: parsed.values.force as boolean }, io);
    }
    case 'render': {
      const parsed = parseSub('render', RENDER_USAGE, rest, {
        project: { type: 'string' },
        force: { type: 'boolean', default: false },
        'allow-missing': { type: 'boolean', default: false },
      }, io);
      if (typeof parsed === 'number') return parsed;
      if (parsed.positionals.length > 0) return unexpected('render', parsed.positionals, RENDER_USAGE, io);
      const root = resolveRoot(parsed.values.project as string | undefined, io);
      if (root === undefined) return EXIT.NOINPUT;
      return runRender({ root, force: parsed.values.force as boolean, allowMissing: parsed.values['allow-missing'] as boolean }, io);
    }
    case 'check': {
      const parsed = parseSub('check', CHECK_USAGE, rest, {
        project: { type: 'string' },
        dist: { type: 'string' },
        strict: { type: 'boolean', default: false },
      }, io);
      if (typeof parsed === 'number') return parsed;
      if (parsed.positionals.length > 0) return unexpected('check', parsed.positionals, CHECK_USAGE, io);
      const root = resolveRoot(parsed.values.project as string | undefined, io);
      if (root === undefined) return EXIT.NOINPUT;
      return runCheck({ root, dist: parsed.values.dist as string | undefined, strict: parsed.values.strict as boolean }, io);
    }
    default:
      io.err(`docsandeye: unknown command "${command}"`);
      io.err('');
      io.err(USAGE);
      return EXIT.USAGE;
  }
}

function unexpected(cmd: string, positionals: string[], usage: string, io: Io): number {
  io.err(`docsandeye ${cmd}: unexpected argument "${positionals[0]}"`);
  io.err('');
  io.err(usage);
  return EXIT.USAGE;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`docsandeye: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = EXIT.PROBLEMS;
  },
);
