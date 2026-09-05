/**
 * Project loader: reads a project tree into a validated, cross-referenced
 * model. The only filesystem access in the package lives here, and it never
 * opens a file whose repo-relative path is denylisted.
 */
import fs from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import semver from 'semver';
import { DocsiError, sortProblems, type Problem } from './errors.js';
import type { HostingRegistry } from './hosting.js';
import {
  CONFIG_FILENAME,
  DEFAULT_DENYLIST,
  parseComponent,
  parseConfig,
  parseMedia,
  parsePin,
  parseStep,
  type Component,
  type Config,
  type Media,
  type Step,
} from './schemas.js';

export interface ProjectModel {
  config: Config;
  components: Map<string, Component>;
  steps: Map<string, Step>;
  media: Map<string, Media>;
  /** Aggregated, sorted by `file` then `path`. */
  problems: Problem[];
}

export const COLLECTION_DIRS = {
  components: 'docs/components',
  steps: 'docs/steps',
  media: 'docs/media',
} as const;

const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);
const MARKDOWN_EXTENSIONS = new Set(['.md']);

/**
 * Basenames (compared case-insensitively) that are never a collection entry.
 * `docs/steps` takes `.md`, so a README written for the maintainers of the
 * project would otherwise be parsed as a step; the YAML collections already
 * ignore it by extension.
 */
const IGNORED_BASENAMES = new Set(['readme.md']);

/**
 * True when `relPath` (POSIX-style, repo-relative) matches any denylist glob.
 * picomatch with `{dot: true}`: `**` spans zero or more segments.
 */
export function isDenylisted(relPath: string, patterns: readonly string[]): boolean {
  if (patterns.length === 0) return false;
  const normalised = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const matcher = picomatch([...patterns], { dot: true });
  return matcher(normalised);
}

export interface LoadProjectOptions {
  /** Hosting registry used when validating the config; defaults to the process-wide default. */
  registry?: HostingRegistry;
}

/** Load `docsandeye.config.yaml` and the three collections under `root`. Throws only when the config itself is unusable. */
export function loadProject(root: string, options: LoadProjectOptions = {}): ProjectModel {
  const config = loadConfig(root, options);
  const problems: Problem[] = [];

  const { items: components } = loadCollection(root, COLLECTION_DIRS.components, YAML_EXTENSIONS, config.denylist, parseComponent, problems);
  const { items: steps, files: stepFiles } = loadCollection(root, COLLECTION_DIRS.steps, MARKDOWN_EXTENSIONS, config.denylist, parseStep, problems);
  const { items: media, files: mediaFiles } = loadCollection(root, COLLECTION_DIRS.media, YAML_EXTENSIONS, config.denylist, parseMedia, problems);

  const defaultGuide = config.guides[0]!.id;
  const guideIds = new Set(config.guides.map((g) => g.id));
  for (const [id, step] of steps) {
    const file = stepFiles.get(id)!;
    if (step.guide === undefined) {
      step.guide = [defaultGuide];
    } else {
      step.guide.forEach((g, i) => {
        if (!guideIds.has(g)) {
          problems.push({ code: 'unknown-guide', file, path: `guide.${i}`, message: `guide "${g}" is not declared in ${CONFIG_FILENAME}` });
        }
      });
    }
    step.parts.forEach((p, i) => checkComponentRef(components, p.component, file, `parts.${i}.component`, problems));
    step.tools.forEach((t, i) => checkComponentRef(components, t.component, file, `tools.${i}.component`, problems));
    step.renders.forEach((r, i) => checkComponentRef(components, r.component, file, `renders.${i}.component`, problems));
    if (step.viewer) checkComponentRef(components, step.viewer.component, file, 'viewer.component', problems);
    step.media?.forEach((m, i) => {
      if (!media.has(m)) {
        problems.push({ code: 'unknown-media', file, path: `media.${i}`, message: `media "${m}" has no manifest in ${COLLECTION_DIRS.media}` });
      }
    });
  }

  for (const [id, manifest] of media) {
    const file = mediaFiles.get(id)!;
    checkPins(components, manifest.hero, file, 'hero', problems);
    checkPins(components, manifest.in_frame, file, 'in_frame', problems);
  }

  sortProblems(problems);
  return { config, components, steps, media, problems };
}

// ---------------------------------------------------------------------------
// Guide filtering

/** Steps whose resolved `guide` includes `guideId`, ordered by `order` then `id`. */
export function stepsForGuide(model: ProjectModel, guideId: string): Step[] {
  return [...model.steps.values()]
    .filter((s) => s.guide?.includes(guideId))
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Internals

interface Collection<T> {
  items: Map<string, T>;
  /** id → repo-relative file path, for problem reporting. */
  files: Map<string, string>;
}

function loadConfig(root: string, options: LoadProjectOptions): Config {
  const rel = CONFIG_FILENAME;
  const abs = path.join(root, rel);
  if (isDenylisted(rel, DEFAULT_DENYLIST) || !fs.existsSync(abs)) {
    throw new DocsiError([{ code: 'schema', file: rel, path: '', message: `${rel} not found under project root` }]);
  }
  const text = fs.readFileSync(abs, 'utf8');
  return parseConfig(text, { registry: options.registry, filename: rel });
}

function loadCollection<T extends { id: string }>(
  root: string,
  dirRel: string,
  extensions: Set<string>,
  denylist: readonly string[],
  parse: (text: string, filename: string) => T,
  problems: Problem[],
): Collection<T> {
  const out: Collection<T> = { items: new Map(), files: new Map() };
  const dirAbs = path.join(root, dirRel);
  if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) return out;

  const names = fs.readdirSync(dirAbs).sort();
  for (const name of names) {
    if (IGNORED_BASENAMES.has(name.toLowerCase())) continue;
    if (!extensions.has(path.extname(name).toLowerCase())) continue;
    const rel = `${dirRel}/${name}`;
    if (isDenylisted(rel, denylist)) continue;
    const abs = path.join(dirAbs, name);
    if (!fs.statSync(abs).isFile()) continue;

    let text: string;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch (err) {
      problems.push({ code: 'invalid-yaml', file: rel, path: '', message: `cannot read file: ${(err as Error).message}` });
      continue;
    }
    let item: T;
    try {
      item = parse(text, rel);
    } catch (err) {
      if (err instanceof DocsiError) {
        problems.push(...err.problems.map((p) => ({ ...p, file: rel })));
        continue;
      }
      throw err;
    }
    if (out.items.has(item.id)) {
      problems.push({
        code: 'duplicate-id',
        file: rel,
        path: 'id',
        message: `duplicate id "${item.id}" (already defined in ${out.files.get(item.id)})`,
      });
      continue;
    }
    out.items.set(item.id, item);
    out.files.set(item.id, rel);
  }
  return out;
}

function checkComponentRef(components: Map<string, Component>, id: string, file: string, at: string, problems: Problem[]): void {
  if (!components.has(id)) {
    problems.push({ code: 'unknown-component', file, path: at, message: `component "${id}" is not defined in ${COLLECTION_DIRS.components}` });
  }
}

function checkPins(components: Map<string, Component>, pins: readonly string[], file: string, field: string, problems: Problem[]): void {
  pins.forEach((raw, i) => {
    const at = `${field}.${i}`;
    const p = parsePin(raw);
    if (!p) return; // schema already rejected malformed pins
    const component = components.get(p.id);
    if (!component) {
      problems.push({ code: 'unknown-component', file, path: at, message: `pin "${raw}" names an unknown component` });
      return;
    }
    if (semver.compare(p.version, component.design_version) === 1) {
      problems.push({
        code: 'future-pin',
        file,
        path: at,
        message: `pin "${raw}" is newer than the component's current design_version ${component.design_version}`,
      });
    }
  });
}
