/**
 * Zod schemas and parse functions for the three content collections
 * (components, steps, media manifests) and the project config.
 *
 * Every parse function throws `DocsiError` whose `problems` carry a stable
 * `code`, the `file` name passed in, a dotted `path` and a `message`.
 */
import path from 'node:path';
import { z } from 'zod';
import YAML from 'yaml';
import { DocsiError, sortProblems, type Problem } from './errors.js';
import { defaultHostingRegistry, type HostingRegistry } from './hosting.js';

// ---------------------------------------------------------------------------
// Primitive shapes

/** `MAJOR.MINOR.PATCH`, non-negative integers, no leading zeros, no pre-release or build metadata. */
export const RELEASE_SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
/** kebab-case identifiers: `[a-z0-9]+(-[a-z0-9.]+)*` */
export const KEBAB_ID_RE = /^[a-z0-9]+(-[a-z0-9.]+)*$/;
/** `<kebab id>@<release semver>` */
export const PIN_RE = /^([a-z0-9]+(?:-[a-z0-9.]+)*)@((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;

export function isReleaseSemver(value: string): boolean {
  return RELEASE_SEMVER_RE.test(value);
}

export interface Pin {
  id: string;
  version: string;
}

/** Split `<id>@<version>`; returns `undefined` when the string is not a valid pin. */
export function parsePin(pin: string): Pin | undefined {
  const m = PIN_RE.exec(pin);
  if (!m) return undefined;
  return { id: m[1]!, version: m[2]! };
}

const releaseSemver = z
  .string()
  .regex(RELEASE_SEMVER_RE, 'must be a release semver MAJOR.MINOR.PATCH (no pre-release or build metadata)');
const kebabId = z.string().regex(KEBAB_ID_RE, 'must be a kebab-case identifier ([a-z0-9]+(-[a-z0-9.]+)*)');
const pin = z.string().regex(PIN_RE, 'must be <id>@<release semver>');
const nonEmptyString = z.string().min(1, 'must be a non-empty string');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date YYYY-MM-DD');

const parameterScalar = z.union([z.string(), z.number(), z.boolean()]);
const parameterValue = z.union([parameterScalar, z.array(parameterScalar)]);

export const COMPONENT_KINDS = ['printed', 'off-the-shelf', 'kitted', 'assembly'] as const;
export const MASTER_FORMATS = ['scad', 'step', 'f3z', 'none'] as const;
export const PART_CATEGORIES = ['part', 'printed', 'tool', 'consumable', 'prev'] as const;
export const RENDER_VIEWS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'iso', 'front-top-right', 'front-top-left'] as const;
export const RENDER_FORMATS = ['png', 'stl', 'svg', 'glb'] as const;
export const MEDIA_TYPES = ['video', 'photo'] as const;

export type ComponentKind = (typeof COMPONENT_KINDS)[number];
export type MasterFormat = (typeof MASTER_FORMATS)[number];
export type PartCategory = (typeof PART_CATEGORIES)[number];
export type RenderView = (typeof RENDER_VIEWS)[number];
export type RenderFormat = (typeof RENDER_FORMATS)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];

// ---------------------------------------------------------------------------
// Component

export const ChangelogEntrySchema = z.object({
  version: releaseSemver,
  date: isoDate,
  note: z.string(),
});

export const SupplierSchema = z.object({
  name: nonEmptyString,
  url: z.string().optional(),
  mpn: z.string().optional(),
});

export const ComponentSchema = z
  .object({
    id: kebabId,
    name: nonEmptyString,
    kind: z.enum(COMPONENT_KINDS),
    design_version: releaseSemver,
    master_format: z.enum(MASTER_FORMATS),
    source_files: z.array(z.string()).default([]),
    parameters: z.record(z.string(), parameterValue).optional(),
    derived_files: z.array(z.string()).default([]),
    depends_on: z.array(z.string()).optional(),
    supersedes: pin.optional(),
    licence: z.string().optional(),
    supplier: SupplierSchema.optional(),
    changelog: z.array(ChangelogEntrySchema).optional(),
  })
  .superRefine((c, ctx) => {
    if (c.master_format === 'none') {
      if (c.source_files.length > 0) {
        ctx.addIssue({ code: 'custom', path: ['source_files'], message: 'must be empty when master_format is none' });
      }
    } else if (c.source_files.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['source_files'], message: `must be non-empty when master_format is ${c.master_format}` });
    }
    if (c.master_format === 'f3z' && c.derived_files.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['derived_files'], message: 'must be non-empty when master_format is f3z' });
    }
    if (c.changelog) {
      const seen = new Set<string>();
      c.changelog.forEach((entry, i) => {
        if (seen.has(entry.version)) {
          ctx.addIssue({ code: 'custom', path: ['changelog', i, 'version'], message: `duplicate changelog version ${entry.version}` });
        }
        seen.add(entry.version);
      });
    }
  })
  .transform((c) => {
    if (c.changelog) {
      c.changelog = [...c.changelog].sort((a, b) => compareRelease(a.version, b.version));
    }
    return c;
  });

export type Component = z.output<typeof ComponentSchema>;
export type ChangelogEntry = z.output<typeof ChangelogEntrySchema>;
export type Supplier = z.output<typeof SupplierSchema>;
export type ParameterValue = z.output<typeof parameterValue>;

/** Compare two release semvers numerically (no `semver` dependency needed for the strict grammar). */
function compareRelease(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Step

const stringOrList = z.union([z.string(), z.array(z.string())]);

const PartSchema = z.object({
  component: nonEmptyString,
  qty: z.number().int().min(1).default(1),
  cat: z.enum(PART_CATEGORIES).default('part'),
});

const ToolSchema = z.object({
  component: nonEmptyString,
  qty: z.number().int().min(1).default(1),
  cat: z.enum(PART_CATEGORIES).default('tool'),
});

export const RenderSchema = z.object({
  id: nonEmptyString,
  component: nonEmptyString,
  view: z.enum(RENDER_VIEWS).default('iso'),
  explode: z.boolean().default(false),
  annotate: z.boolean().default(false),
  format: z.enum(RENDER_FORMATS).default('png'),
});

export const ViewerSchema = z.object({
  component: nonEmptyString,
  format: z.enum(RENDER_FORMATS).default('glb'),
});

export const StepFrontmatterSchema = z
  .object({
    id: kebabId,
    order: z.number().int().min(0),
    title: nonEmptyString,
    guide: stringOrList.optional().transform((g) => (g === undefined ? undefined : Array.isArray(g) ? g : [g])),
    branch: stringOrList.optional(),
    parts: z.array(PartSchema).default([]),
    tools: z.array(ToolSchema).default([]),
    renders: z.array(RenderSchema).default([]),
    viewer: ViewerSchema.optional(),
    media: z.array(z.string()).optional(),
    safety: z.string().optional(),
  })
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    s.renders.forEach((r, i) => {
      if (seen.has(r.id)) {
        ctx.addIssue({ code: 'custom', path: ['renders', i, 'id'], message: `duplicate render id ${r.id} within step` });
      }
      seen.add(r.id);
    });
  });

export type StepFrontmatter = z.output<typeof StepFrontmatterSchema>;
export type StepPart = z.output<typeof PartSchema>;
export type StepRender = z.output<typeof RenderSchema>;
export type StepViewer = z.output<typeof ViewerSchema>;
export interface Step extends StepFrontmatter {
  /** Markdown body following the frontmatter fence. */
  body: string;
}

// ---------------------------------------------------------------------------
// Media

export const MediaSchema = z
  .object({
    id: kebabId,
    type: z.enum(MEDIA_TYPES),
    file: nonEmptyString,
    poster: z.string().optional(),
    captions: z.string().optional(),
    duration_s: z.number().positive('must be a number > 0').optional(),
    shot_date: isoDate,
    shot_by: z.string(),
    hero: z.array(pin).min(1, 'must list at least one hero pin'),
    in_frame: z.array(pin).default([]),
    narration_source: z.string().optional(),
    licence: z.string().optional(),
  })
  .superRefine((m, ctx) => {
    if (m.type === 'video') {
      if (m.poster === undefined) ctx.addIssue({ code: 'custom', path: ['poster'], message: 'required for video' });
      if (m.duration_s === undefined) ctx.addIssue({ code: 'custom', path: ['duration_s'], message: 'required for video' });
    } else {
      for (const key of ['poster', 'captions', 'duration_s'] as const) {
        if (m[key] !== undefined) ctx.addIssue({ code: 'custom', path: [key], message: 'not allowed for photo' });
      }
    }
  });

export type Media = z.output<typeof MediaSchema>;

// ---------------------------------------------------------------------------
// Config

export const DEFAULT_DENYLIST: readonly string[] = [
  'private-notes/**',
  '.claude/**',
  '.vibe/**',
  '.git/**',
  'node_modules/**',
];

export const GuideSchema = z.object({
  id: kebabId,
  title: nonEmptyString,
  base: z.string().regex(/^\//, 'must start with "/"'),
});

const HostingSchema = z.looseObject({
  provider: nonEmptyString,
  base: z.string().optional(),
});

function buildConfigSchema(registry: HostingRegistry) {
  return z
    .object({
      theme: z.string().default('starlight'),
      guides: z.array(GuideSchema).min(1, 'must declare at least one guide'),
      denylist: z.array(z.string()).default([]),
      hosting: HostingSchema.default({ provider: 'local' }),
      byte_budget_kb: z.number().int().positive().default(150),
    })
    .superRefine((c, ctx) => {
      const seen = new Set<string>();
      c.guides.forEach((g, i) => {
        if (seen.has(g.id)) ctx.addIssue({ code: 'custom', path: ['guides', i, 'id'], message: `duplicate guide id ${g.id}` });
        seen.add(g.id);
      });
      if (!registry.has(c.hosting.provider)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hosting', 'provider'],
          message: `unknown hosting provider "${c.hosting.provider}" (registered: ${registry.names().join(', ')})`,
        });
      } else if (c.hosting.provider === 'url-prefix' && !c.hosting.base) {
        ctx.addIssue({ code: 'custom', path: ['hosting', 'base'], message: 'required for the url-prefix provider' });
      }
    })
    .transform((c) => ({
      ...c,
      denylist: mergeDenylist(c.denylist),
    }));
}

/** Schema against the default registry (exported for typing; `parseConfig` builds a fresh one per call). */
export const ConfigSchema = buildConfigSchema(defaultHostingRegistry);
export type Config = z.output<typeof ConfigSchema>;
export type Guide = z.output<typeof GuideSchema>;

/** Defaults first, then user entries, de-duplicated preserving first occurrence. */
export function mergeDenylist(userEntries: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of [...DEFAULT_DENYLIST, ...userEntries]) {
    if (!out.includes(entry)) out.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------------------
// YAML + frontmatter helpers

function yamlProblem(err: unknown, file: string): Problem {
  const message = err instanceof Error ? err.message.split('\n')[0]! : String(err);
  return { code: 'invalid-yaml', file, path: '', message };
}

/** Parse a YAML document, throwing `DocsiError` (`invalid-yaml`) when it is not well-formed. */
export function parseYamlDocument(text: string, file: string): unknown {
  try {
    return YAML.parse(text);
  } catch (err) {
    throw new DocsiError([yamlProblem(err, file)]);
  }
}

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

const FENCE_RE = /^---\r?$/;

/**
 * Split a Markdown file into `---`-fenced YAML frontmatter and body. Handles LF and CRLF.
 * No opening fence on line 1 → `{data: {}, body: text}`. Unterminated fence → `DocsiError` (`invalid-yaml`).
 */
export function readFrontmatter(text: string, file = ''): Frontmatter {
  const firstNewline = text.indexOf('\n');
  const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline);
  if (!FENCE_RE.test(firstLine)) return { data: {}, body: text };
  if (firstNewline === -1) {
    throw new DocsiError([{ code: 'invalid-yaml', file, path: '', message: 'unterminated frontmatter fence' }]);
  }

  const lines = text.slice(firstNewline + 1).split('\n');
  let closing = -1;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i]!)) {
      closing = i;
      break;
    }
  }
  if (closing === -1) {
    throw new DocsiError([{ code: 'invalid-yaml', file, path: '', message: 'unterminated frontmatter fence' }]);
  }
  // Frontmatter YAML is normalised to LF so a CRLF file does not leave stray `\r` in scalar values; the body is left untouched.
  const yamlText = lines.slice(0, closing).map((l) => l.replace(/\r$/, '')).join('\n');
  const body = lines.slice(closing + 1).join('\n');

  const parsed = yamlText.trim() === '' ? {} : parseYamlDocument(yamlText, file);
  if (parsed === null || parsed === undefined) return { data: {}, body };
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new DocsiError([{ code: 'invalid-yaml', file, path: '', message: 'frontmatter must be a YAML mapping' }]);
  }
  return { data: parsed as Record<string, unknown>, body };
}

// ---------------------------------------------------------------------------
// Parse functions

function stemOf(filename: string): string {
  return path.posix.basename(filename.replace(/\\/g, '/')).replace(/\.[^.]*$/, '');
}

function zodProblems(error: z.ZodError, file: string): Problem[] {
  return sortProblems(
    error.issues.map((issue) => ({
      code: 'schema' as const,
      file,
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  );
}

function validate<S extends z.ZodType>(schema: S, data: unknown, file: string): z.output<S> {
  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    throw new DocsiError([{ code: 'schema', file, path: '', message: 'document must be a YAML mapping' }]);
  }
  const result = schema.safeParse(data);
  if (!result.success) throw new DocsiError(zodProblems(result.error, file));
  return result.data;
}

function checkIdMatchesStem(id: string, filename: string): void {
  const stem = stemOf(filename);
  if (id !== stem) {
    throw new DocsiError([
      { code: 'id-mismatch', file: filename, path: 'id', message: `id "${id}" does not match filename stem "${stem}"` },
    ]);
  }
}

/** Parse a component YAML file. `filename` may be a bare name or a repo-relative path. */
export function parseComponent(text: string, filename: string): Component {
  const component = validate(ComponentSchema, parseYamlDocument(text, filename), filename);
  checkIdMatchesStem(component.id, filename);
  return component;
}

/** Parse a step Markdown file (YAML frontmatter + body). */
export function parseStep(text: string, filename: string): Step {
  const { data, body } = readFrontmatter(text, filename);
  const frontmatter = validate(StepFrontmatterSchema, data, filename);
  checkIdMatchesStem(frontmatter.id, filename);
  return { ...frontmatter, body };
}

/** Parse a media manifest YAML file (video or photo). */
export function parseMedia(text: string, filename: string): Media {
  const media = validate(MediaSchema, parseYamlDocument(text, filename), filename);
  checkIdMatchesStem(media.id, filename);
  return media;
}

export interface ParseConfigOptions {
  /** Hosting registry used to validate `hosting.provider`; defaults to the process-wide default registry. */
  registry?: HostingRegistry;
  /** File name used in problems; defaults to `docsandeye.config.yaml`. */
  filename?: string;
}

export const CONFIG_FILENAME = 'docsandeye.config.yaml';

/** Parse `docsandeye.config.yaml`, applying defaults and validating the hosting provider against a registry. */
export function parseConfig(text: string, options: ParseConfigOptions = {}): Config {
  const registry = options.registry ?? defaultHostingRegistry;
  const filename = options.filename ?? CONFIG_FILENAME;
  return validate(buildConfigSchema(registry), parseYamlDocument(text, filename), filename);
}
