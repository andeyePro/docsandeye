/**
 * `docsandeye init <dir>`: copy the template tree, substituting the guide id
 * and title. Refuses to touch an existing project unless `--force`, and even
 * then only rewrites the files the template owns.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILENAME } from '@docsandeye/core';
import { EXIT, type Io } from './common.js';
import { templatesDir } from './paths.js';

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

/** Escape a value for use inside a double-quoted JSON, JS or YAML string. */
function quoteEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function renderTemplate(text: string, vars: { guide: string; title: string; date: string }): string {
  return text
    .replace(/\{\{guide\}\}/g, vars.guide)
    .replace(/\{\{title\}\}/g, quoteEscape(vars.title))
    .replace(/\{\{title_text\}\}/g, vars.title)
    .replace(/\{\{date\}\}/g, vars.date);
}

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
  const vars = { guide: opts.guide, title: opts.title, date: new Date().toISOString().slice(0, 10) };
  for (const rel of templateFiles(templates)) {
    const source = fs.readFileSync(path.join(templates, rel), 'utf8');
    const target = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, renderTemplate(source, vars));
  }
  io.out(`init: created Docs&I project in ${dir} (guide "${opts.guide}")`);
  io.out('next: cd into it, npm install, then docsandeye render && npm run build');
  return EXIT.OK;
}
