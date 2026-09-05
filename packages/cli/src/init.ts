/**
 * `docsandeye init <dir>`: copy the template tree, substituting the guide id
 * and title. Refuses to touch an existing project unless `--force`, and even
 * then only rewrites the files the template owns.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILENAME } from '@docsandeye/core';
import { EXIT, type Io } from './common.js';
import { cliPackageDir, templatesDir } from './paths.js';

export interface InitOptions {
  dir: string;
  guide: string;
  title: string;
  force: boolean;
}

/** Files whose presence marks `<dir>` as an existing project, in the order they are reported. */
export const PROJECT_MARKERS = [CONFIG_FILENAME, 'astro.config.mjs'] as const;

/** Every file under `templates/`, as `/`-separated relative paths, sorted. */
export function templateFiles(dir = templatesDir()): string[] {
  const out: string[] = [];
  const walk = (d: string, rel: string): void => {
    for (const name of fs.readdirSync(d).sort()) {
      const abs = path.join(d, name);
      const relPath = rel === '' ? name : `${rel}/${name}`;
      if (fs.statSync(abs).isDirectory()) walk(abs, relPath);
      else out.push(relPath);
    }
  };
  walk(dir, '');
  return out;
}

/**
 * Workspace packages a scaffolded project depends on, as `<dependency name>`
 * → `<path under the monorepo root>`. Used only when `init` runs from a clone
 * of the Docs&I monorepo (see `monorepoRoot`).
 */
export const LOCAL_PACKAGE_DIRS: Readonly<Record<string, string>> = {
  docsandeye: 'packages/cli',
  'starlight-docsandeye': 'packages/starlight-docsandeye',
};

/** Registry specifiers written into a scaffolded `package.json` outside the monorepo. */
export const REGISTRY_SPECIFIERS: Readonly<Record<string, string>> = {
  docsandeye: '^0.1.0',
  'starlight-docsandeye': '^0.1.0',
};

/**
 * The Docs&I monorepo root when this CLI is running from a checkout of it
 * (`packages/cli/dist/init.js`), otherwise `undefined` — an installed copy
 * lives in `node_modules/docsandeye` and never matches.
 */
export function monorepoRoot(from: string = cliPackageDir()): string | undefined {
  const root = path.resolve(from, '..', '..');
  let pkg: { name?: unknown; workspaces?: unknown };
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as typeof pkg;
  } catch {
    return undefined;
  }
  const workspaces = Array.isArray(pkg.workspaces) ? (pkg.workspaces as unknown[]).map(String) : [];
  const named = pkg.name === 'docsandeye' || pkg.name === 'docsandeye-monorepo';
  if (!named || !workspaces.includes('packages/*')) return undefined;
  for (const rel of Object.values(LOCAL_PACKAGE_DIRS)) {
    if (!fs.existsSync(path.join(root, ...rel.split('/'), 'package.json'))) return undefined;
  }
  return root;
}

/** `file:` specifier for `dir` → `target`, always `/`-separated and explicitly relative. */
function fileSpecifier(dir: string, target: string): string {
  const rel = path.relative(dir, target).split(path.sep).join('/');
  return `file:${rel === '' ? '.' : rel.startsWith('.') ? rel : `./${rel}`}`;
}

/**
 * Dependency specifiers for a project scaffolded into `dir`: `file:` links to
 * this checkout inside the monorepo (there is no npm release yet), registry
 * ranges everywhere else.
 */
export function dependencySpecifiers(dir: string, root: string | undefined): Record<string, string> {
  if (root === undefined) return { ...REGISTRY_SPECIFIERS };
  const out: Record<string, string> = {};
  for (const [name, rel] of Object.entries(LOCAL_PACKAGE_DIRS)) {
    out[name] = fileSpecifier(path.resolve(dir), path.join(root, ...rel.split('/')));
  }
  return out;
}

/** Escape a value for use inside a double-quoted JSON, JS or YAML string. */
function quoteEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export interface TemplateVars {
  guide: string;
  title: string;
  date: string;
  /** Dependency specifiers, `<name>` → `^0.1.0` or `file:../…`. */
  deps: Record<string, string>;
  /** One sentence under the generated README's Commands section explaining `deps`. */
  depsNote: string;
}

export function renderTemplate(text: string, vars: TemplateVars): string {
  return text
    .replace(/\{\{guide\}\}/g, vars.guide)
    .replace(/\{\{title\}\}/g, quoteEscape(vars.title))
    .replace(/\{\{title_text\}\}/g, vars.title)
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{docsandeye_spec\}\}/g, quoteEscape(vars.deps.docsandeye ?? REGISTRY_SPECIFIERS.docsandeye!))
    .replace(
      /\{\{starlight_docsandeye_spec\}\}/g,
      quoteEscape(vars.deps['starlight-docsandeye'] ?? REGISTRY_SPECIFIERS['starlight-docsandeye']!),
    )
    .replace(/\{\{deps_note\}\}/g, vars.depsNote);
}

const LOCAL_DEPS_NOTE =
  'This project was scaffolded from a clone of the Docs&I monorepo, so `docsandeye` and `starlight-docsandeye`\nare `file:` links to that checkout rather than registry versions; swap them for registry ranges once Docs&I\nis published to npm.';
const REGISTRY_DEPS_NOTE =
  '`docsandeye` and `starlight-docsandeye` are installed from npm; run `npm install` before the commands above.';

export function runInit(opts: InitOptions, io: Io): number {
  const dir = path.resolve(opts.dir);
  if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) {
    io.err(`init: ${opts.dir} exists and is not a directory`);
    return EXIT.DATAERR;
  }
  if (!opts.force) {
    for (const marker of PROJECT_MARKERS) {
      if (fs.existsSync(path.join(dir, marker))) {
        io.err(`init: ${marker} already exists (use --force to overwrite template files)`);
        return EXIT.DATAERR;
      }
    }
  }

  const templates = templatesDir();
  const root = monorepoRoot();
  const deps = dependencySpecifiers(dir, root);
  const vars: TemplateVars = {
    guide: opts.guide,
    title: opts.title,
    date: new Date().toISOString().slice(0, 10),
    deps,
    depsNote: root === undefined ? REGISTRY_DEPS_NOTE : LOCAL_DEPS_NOTE,
  };
  for (const rel of templateFiles(templates)) {
    const source = fs.readFileSync(path.join(templates, rel), 'utf8');
    const target = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, renderTemplate(source, vars));
  }
  io.out(`init: created Docs&I project in ${dir} (guide "${opts.guide}")`);
  if (root !== undefined) {
    io.out(`init: dependencies point at this checkout with file: specifiers (docsandeye ${deps.docsandeye})`);
  }
  io.out('next: cd into it, npm install, then docsandeye render && npm run build');
  return EXIT.OK;
}
