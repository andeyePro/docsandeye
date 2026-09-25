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
import { PROFILE_TYPES, YOUTUBE_ID_RE, choosableOptions, impliesProblems, type ProfileItem } from './interactive.js';

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

/**
 * A `when` condition: `{<profile id>: <value> | [<values>]}`. The shape is
 * checked here; ids and values are checked against the config's `profile` by
 * the loader (the schema alone does not know the profile).
 */
export const WhenSchema = z.record(z.string(), z.union([parameterScalar, z.array(parameterScalar).min(1, 'must list at least one value')]));

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

export const RECEIPT_PER = ['unit', 'kit'] as const;

/** A component's place in the "count what you received" checklist. */
export const ComponentReceiptSchema = z.object({
  per: z.enum(RECEIPT_PER).default('unit'),
  qty: z.number().int().min(1).default(1),
  from: z.array(kebabId).optional(),
  when: WhenSchema.optional(),
  note: z.string().optional(),
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
    receipt: ComponentReceiptSchema.optional(),
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
export type ComponentReceipt = z.output<typeof ComponentReceiptSchema>;
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
  when: WhenSchema.optional(),
});

const ToolSchema = z.object({
  component: nonEmptyString,
  qty: z.number().int().min(1).default(1),
  cat: z.enum(PART_CATEGORIES).default('tool'),
  when: WhenSchema.optional(),
});

const CheckIssueSchema = z.object({
  problem: nonEmptyString,
  fix: nonEmptyString,
});

/** A yes/no check at the end of a step; `issues` are shown when the reader answers No. */
export const CheckSchema = z.object({
  id: kebabId,
  question: nonEmptyString,
  issues: z.array(CheckIssueSchema).default([]),
  when: WhenSchema.optional(),
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
    /** Show the step only when the reader's profile matches. */
    when: WhenSchema.optional(),
    /** Render the receipt checklist on this step. */
    receipt: z.boolean().optional(),
    /** Render the profile form on this step (the guide index always has it). */
    profile: z.boolean().optional(),
    checks: z.array(CheckSchema).optional(),
    /** Mark the checks as a draft under review. */
    checks_draft: z.boolean().optional(),
  })
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    s.renders.forEach((r, i) => {
      if (seen.has(r.id)) {
        ctx.addIssue({ code: 'custom', path: ['renders', i, 'id'], message: `duplicate render id ${r.id} within step` });
      }
      seen.add(r.id);
    });
    const checkIds = new Set<string>();
    s.checks?.forEach((c, i) => {
      if (checkIds.has(c.id)) {
        ctx.addIssue({ code: 'custom', path: ['checks', i, 'id'], message: `duplicate check id ${c.id} within step` });
      }
      checkIds.add(c.id);
    });
  });

export type StepFrontmatter = z.output<typeof StepFrontmatterSchema>;
export type StepPart = z.output<typeof PartSchema>;
export type StepRender = z.output<typeof RenderSchema>;
export type StepViewer = z.output<typeof ViewerSchema>;
export type StepCheck = z.output<typeof CheckSchema>;
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
    /** Required unless the clip is on YouTube. */
    file: nonEmptyString.optional(),
    /** An 11-character YouTube video id: the clip is embedded behind a click-to-load facade instead of self-hosted. */
    youtube: z.string().regex(YOUTUBE_ID_RE, 'must be an 11-character YouTube video id ([A-Za-z0-9_-]{11})').optional(),
    start_s: z.number().int('must be a non-negative integer').min(0, 'must be a non-negative integer').optional(),
    end_s: z.number().int('must be a non-negative integer').min(0, 'must be a non-negative integer').optional(),
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
    if (m.youtube === undefined) {
      if (m.file === undefined) ctx.addIssue({ code: 'custom', path: ['file'], message: 'required (unless youtube is set)' });
      for (const key of ['start_s', 'end_s'] as const) {
        if (m[key] !== undefined) ctx.addIssue({ code: 'custom', path: [key], message: 'only allowed with youtube' });
      }
    } else {
      if (m.type !== 'video') ctx.addIssue({ code: 'custom', path: ['youtube'], message: 'only allowed for video' });
      if (m.captions !== undefined) ctx.addIssue({ code: 'custom', path: ['captions'], message: 'not allowed with youtube (YouTube serves its own captions)' });
      if (m.start_s !== undefined && m.end_s !== undefined && m.end_s <= m.start_s) {
        ctx.addIssue({ code: 'custom', path: ['end_s'], message: 'must be greater than start_s' });
      }
    }
    if (m.type === 'video') {
      if (m.youtube === undefined) {
        if (m.poster === undefined) ctx.addIssue({ code: 'custom', path: ['poster'], message: 'required for video' });
        if (m.duration_s === undefined) ctx.addIssue({ code: 'custom', path: ['duration_s'], message: 'required for video' });
      }
    } else {
      for (const key of ['poster', 'captions', 'duration_s'] as const) {
        if (m[key] !== undefined) ctx.addIssue({ code: 'custom', path: [key], message: 'not allowed for photo' });
      }
    }
  });

export type Media = z.output<typeof MediaSchema>;

// ---------------------------------------------------------------------------
// Glossary

/** Longest tip a glossary entry may carry: a popover, not a paragraph. */
export const GLOSSARY_TIP_MAX = 240;

export const GlossaryEntrySchema = z.object({
  /** Matched case-insensitively as a whole word. */
  term: nonEmptyString,
  /** Aliases matched the same way (`septa` for `septum`). */
  terms: z.array(nonEmptyString).optional(),
  tip: nonEmptyString.max(GLOSSARY_TIP_MAX, `must be at most ${GLOSSARY_TIP_MAX} characters`),
  /** Optional "read more" link. */
  link: nonEmptyString.optional(),
});

/** `docs/glossary.yaml`: a list of entries; no term or alias may appear twice (case-insensitively). */
export const GlossarySchema = z.array(GlossaryEntrySchema).superRefine((entries, ctx) => {
  const seen = new Map<string, number>();
  entries.forEach((entry, i) => {
    const words: Array<[string, (string | number)[]]> = [[entry.term, [i, 'term']], ...(entry.terms ?? []).map((t, j): [string, (string | number)[]] => [t, [i, 'terms', j]])];
    for (const [word, at] of words) {
      const key = word.trim().toLowerCase();
      const first = seen.get(key);
      if (first !== undefined) ctx.addIssue({ code: 'custom', path: at, message: `duplicate glossary term "${word}" (already in entry ${first})` });
      else seen.set(key, i);
    }
  });
});

export type GlossaryEntryOutput = z.output<typeof GlossaryEntrySchema>;

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

/**
 * Optional project-level metadata, used by `docsandeye export` to fill an Open
 * Know-How manifest. Unlike the other config schemas this one is STRICT: an
 * unknown key here is a typo in a field an exporter would silently drop, so it
 * is reported as a `schema` problem at `project.<key>` rather than stripped.
 * Every field is optional; whatever is absent is omitted from the manifest.
 */
export const ProjectMetaSchema = z.strictObject({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  /** SPDX-style identifier for the project as a whole; components carry their own `licence`. */
  licence: z.string().optional(),
  licensor: z.string().optional(),
  repo: z.url().optional(),
  function: z.string().optional(),
  documentation_home: z.url().optional(),
});

const ProfileOptionSchema = z.object({
  value: kebabId,
  /** May contain Markdown links `[text](url)`. */
  label: nonEmptyString,
  /** Answers this choice settles, `{<profile id>: <value>}`; checked against the other items in the config refinement. */
  implies: z.record(z.string(), parameterScalar).optional(),
  /** A link option: navigates instead of being chosen. */
  href: nonEmptyString.optional(),
});

/**
 * One reader question. `default` is filled in when absent (number: `min`;
 * boolean: false; choice: the first option), and `min`/`max` default to 1
 * and 100 for numbers, so the output always carries a usable default.
 */
export const ProfileItemSchema = z
  .object({
    id: kebabId,
    type: z.enum(PROFILE_TYPES),
    label: nonEmptyString,
    default: z.union([z.number(), z.boolean(), z.string()]).optional(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    options: z.array(ProfileOptionSchema).optional(),
    /** A short name for summaries and "Only with …" labels (`temperature kit`); defaults to `label` in the summary. */
    short: nonEmptyString.optional(),
    /** number only: the unit, singular and plural (`Pioreactor`, `Pioreactors`); default the id. */
    unit_label: nonEmptyString.optional(),
    unit_label_plural: nonEmptyString.optional(),
    /** The guides this question belongs to; absent = every guide. Checked against `guides` by the config refinement. */
    guides: z.array(kebabId).min(1, 'must list at least one guide id').optional(),
  })
  .superRefine((p, ctx) => {
    if (p.type === 'choice') {
      if (!p.options || p.options.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'required and non-empty for a choice' });
      } else {
        const seen = new Set<string>();
        p.options.forEach((o, i) => {
          if (seen.has(o.value)) ctx.addIssue({ code: 'custom', path: ['options', i, 'value'], message: `duplicate option value ${o.value}` });
          seen.add(o.value);
        });
        if (choosableOptions(p).length === 0) {
          ctx.addIssue({ code: 'custom', path: ['options'], message: 'needs at least one option without href (link options cannot be chosen)' });
        }
      }
    } else if (p.options !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `not allowed for ${p.type}` });
    }
    if (p.type !== 'number') {
      for (const key of ['min', 'max', 'unit_label', 'unit_label_plural'] as const) {
        if (p[key] !== undefined) ctx.addIssue({ code: 'custom', path: [key], message: `only allowed for number (this item is ${p.type})` });
      }
    }
    const min = p.min ?? 1;
    const max = p.max ?? 100;
    if (p.type === 'number' && min > max) ctx.addIssue({ code: 'custom', path: ['max'], message: `must be >= min (${min})` });
    if (p.default === undefined) return;
    if (p.type === 'number') {
      if (typeof p.default !== 'number' || !Number.isInteger(p.default) || p.default < min || p.default > max) {
        ctx.addIssue({ code: 'custom', path: ['default'], message: `must be an integer from ${min} to ${max}` });
      }
    } else if (p.type === 'boolean') {
      if (typeof p.default !== 'boolean') ctx.addIssue({ code: 'custom', path: ['default'], message: 'must be true or false' });
    } else if (typeof p.default !== 'string' || !choosableOptions(p).some((o) => o.value === p.default)) {
      const linked = (p.options ?? []).some((o) => o.href !== undefined && o.value === p.default);
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: linked
          ? `"${String(p.default)}" is a link option (href) and cannot be the default`
          : `must be one of the option values (${choosableOptions(p)
              .map((o) => o.value)
              .join(', ')})`,
      });
    }
  })
  .transform((p): ProfileItem => {
    const out: ProfileItem = { id: p.id, type: p.type, label: p.label, default: false };
    if (p.short !== undefined) out.short = p.short;
    if (p.guides !== undefined) out.guides = p.guides;
    if (p.type === 'number') {
      out.min = p.min ?? 1;
      out.max = p.max ?? 100;
      out.default = p.default ?? out.min;
      if (p.unit_label !== undefined) out.unit_label = p.unit_label;
      if (p.unit_label_plural !== undefined) out.unit_label_plural = p.unit_label_plural;
    } else if (p.type === 'boolean') {
      out.default = p.default ?? false;
    } else {
      out.options = (p.options ?? []).map((o) => {
        const option: NonNullable<ProfileItem['options']>[number] = { value: o.value, label: o.label };
        if (o.implies !== undefined) option.implies = o.implies;
        if (o.href !== undefined) option.href = o.href;
        return option;
      });
      out.default = p.default ?? choosableOptions(out)[0]?.value ?? '';
    }
    return out;
  });

export const ReceiptConfigSchema = z.object({
  multiply_by: kebabId.optional(),
  supplier_from: kebabId.optional(),
});

export const ContactSchema = z.object({
  name: nonEmptyString,
  email: z.string().regex(/@/, 'must be an email address (contain @)').optional(),
  subject: z.string().optional(),
});

const HostingSchema = z.looseObject({
  provider: nonEmptyString,
  base: z.string().optional(),
});

function buildConfigSchema(registry: HostingRegistry) {
  return z
    .object({
      theme: z.string().default('starlight'),
      project: ProjectMetaSchema.optional(),
      guides: z.array(GuideSchema).min(1, 'must declare at least one guide'),
      denylist: z.array(z.string()).default([]),
      hosting: HostingSchema.default({ provider: 'local' }),
      byte_budget_kb: z.number().int().positive().default(150),
      /** Reader questions, in display order. */
      profile: z.array(ProfileItemSchema).default([]),
      receipt: ReceiptConfigSchema.optional(),
      /** Keyed by a choice value of `receipt.supplier_from`, plus the reserved key `project`. */
      contacts: z.record(z.string(), ContactSchema).default({}),
    })
    .superRefine((c, ctx) => {
      const seen = new Set<string>();
      c.guides.forEach((g, i) => {
        if (seen.has(g.id)) ctx.addIssue({ code: 'custom', path: ['guides', i, 'id'], message: `duplicate guide id ${g.id}` });
        seen.add(g.id);
      });
      checkProfileConfig(c, ctx);
      c.profile.forEach((item, i) => {
        item.guides?.forEach((g, j) => {
          if (!seen.has(g)) ctx.addIssue({ code: 'custom', path: ['profile', i, 'guides', j], message: `guide "${g}" is not declared in guides` });
        });
      });
      if (!registry.has(c.hosting.provider)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hosting', 'provider'],
          message: `unknown hosting provider "${c.hosting.provider}" (registered: ${registry.names().join(', ')})`,
        });
      } else if (registry.get(c.hosting.provider)?.requiresBase === true && !c.hosting.base) {
        ctx.addIssue({ code: 'custom', path: ['hosting', 'base'], message: `required for the ${c.hosting.provider} provider` });
      }
    })
    .transform((c) => ({
      ...c,
      denylist: mergeDenylist(c.denylist),
    }));
}

interface ProfileConfigView {
  profile: ProfileItem[];
  receipt?: { multiply_by?: string; supplier_from?: string } | undefined;
  contacts: Record<string, unknown>;
}

/** Cross-field rules of `profile`, `receipt` and `contacts`. */
function checkProfileConfig(c: ProfileConfigView, ctx: z.core.$RefinementCtx): void {
  const byId = new Map<string, ProfileItem>();
  c.profile.forEach((item, i) => {
    if (byId.has(item.id)) ctx.addIssue({ code: 'custom', path: ['profile', i, 'id'], message: `duplicate profile id ${item.id}` });
    else byId.set(item.id, item);
  });
  for (const problem of impliesProblems(c.profile)) {
    ctx.addIssue({ code: 'custom', path: ['profile', ...problem.path.split('.').map((k) => (/^\d+$/.test(k) ? Number(k) : k))], message: problem.message });
  }
  const refs = [
    ['multiply_by', 'number'],
    ['supplier_from', 'choice'],
  ] as const;
  for (const [key, type] of refs) {
    const id = c.receipt?.[key];
    if (id === undefined) continue;
    const item = byId.get(id);
    if (!item) ctx.addIssue({ code: 'custom', path: ['receipt', key], message: `"${id}" is not a profile id` });
    else if (item.type !== type) ctx.addIssue({ code: 'custom', path: ['receipt', key], message: `must name a ${type}-type profile item ("${id}" is ${item.type})` });
  }
  const supplierItem = c.receipt?.supplier_from !== undefined ? byId.get(c.receipt.supplier_from) : undefined;
  if (c.receipt !== undefined && supplierItem?.type === 'choice') {
    const values = new Set((supplierItem.options ?? []).map((o) => o.value));
    for (const key of Object.keys(c.contacts)) {
      if (key !== 'project' && !values.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['contacts', key],
          message: `must be "project" or an option value of "${supplierItem.id}" (${[...values].join(', ')})`,
        });
      }
    }
  }
}

/** Schema against the default registry (exported for typing; `parseConfig` builds a fresh one per call). */
export const ConfigSchema = buildConfigSchema(defaultHostingRegistry);
export type Config = z.output<typeof ConfigSchema>;
export type Guide = z.output<typeof GuideSchema>;
export type ProjectMeta = z.output<typeof ProjectMetaSchema>;
export type ContactConfig = z.output<typeof ContactSchema>;
export type ReceiptConfigOutput = z.output<typeof ReceiptConfigSchema>;

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
  const problems: Problem[] = [];
  for (const issue of error.issues) {
    const at = issue.path.map(String);
    // An `unrecognized_keys` issue names the offending keys in a payload rather
    // than in its path; report one problem per key, at `<object path>.<key>`.
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        problems.push({ code: 'schema', file, path: [...at, key].join('.'), message: `unrecognized key "${key}"` });
      }
      continue;
    }
    problems.push({ code: 'schema', file, path: at.join('.'), message: issue.message });
  }
  return sortProblems(problems);
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

/** Parse `docs/glossary.yaml` (a YAML list; an empty file is an empty glossary). */
export function parseGlossary(text: string, filename: string): GlossaryEntryOutput[] {
  const data = parseYamlDocument(text, filename);
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) throw new DocsiError([{ code: 'schema', file: filename, path: '', message: 'document must be a YAML list of glossary entries' }]);
  const result = GlossarySchema.safeParse(data);
  if (!result.success) throw new DocsiError(zodProblems(result.error, filename));
  return result.data;
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
