/**
 * Export plan: BuildUp-flavoured Markdown (one file per step plus an index)
 * and an Open Know-How (OKH) manifest, computed purely from the loaded model.
 *
 * The plan is a value, not an effect: no file reads, no writes, no clock, no
 * network. The CLI (`docsandeye export`) is what puts the bytes on disk.
 */
import { stepsForGuide, type ProjectModel } from './load.js';
import { parsePin, type Component, type Media, type Step } from './schemas.js';

export const EXPORT_PLAN_VERSION = 1 as const;
/** Directory prefix every plan entry is written under; the CLI may relocate it. */
export const EXPORT_OUTPUT_DIR = 'build/export';

export interface ExportFile {
  /** Repo-relative POSIX path, always under `build/export/`. */
  path: string;
  content: string;
}

export interface ExportPlan {
  version: typeof EXPORT_PLAN_VERSION;
  /** `index.md` first, then one file per step in export order. */
  buildup: ExportFile[];
  okh: ExportFile;
}

// ---------------------------------------------------------------------------
// BuildUp inline links

/** One `parts:`/`tools:` entry resolved against the component collection. */
export interface BuildUpRef {
  /** The component's `name`, or its id when the component is unknown. */
  name: string;
  qty: number;
  cat: string;
}

export interface BuildUpSubstitution {
  /** The body with each substituted reference rewritten as a BuildUp link. */
  body: string;
  /** Parallel to the refs passed in: `true` when that ref was substituted inline. */
  inlined: boolean[];
}

/** `[<name>]{qty: <qty>, cat: <cat>}` — BuildUp's inline part syntax. */
export function buildUpLink(ref: BuildUpRef): string {
  return `[${ref.name}]{qty: ${ref.qty}, cat: ${ref.cat}}`;
}

/** Escape every regular-expression metacharacter so a name matches literally. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_]/.test(ch);
}

/**
 * Replace the FIRST eligible occurrence of each ref's `name` in `body` with a
 * BuildUp inline link, refs processed in the order given.
 *
 * An occurrence is eligible when it matches literally and case-sensitively, is
 * whole-word (no `[A-Za-z0-9_]` immediately either side), lies outside fenced
 * code blocks, inline code spans and existing Markdown links (`[…](…)` or
 * `[…]{…}`), and does not overlap a span already claimed by an earlier ref.
 * A ref with no eligible occurrence is left for the `## Parts`/`## Tools` list.
 */
export function substituteBuildUpLinks(body: string, refs: readonly BuildUpRef[]): BuildUpSubstitution {
  const claimed = protectedMask(body);
  const inlined: boolean[] = [];
  const edits: Array<{ start: number; end: number; text: string }> = [];

  for (const ref of refs) {
    const found = findOccurrence(body, ref.name, claimed);
    if (found === undefined) {
      inlined.push(false);
      continue;
    }
    fillMask(claimed, found, found + ref.name.length);
    edits.push({ start: found, end: found + ref.name.length, text: buildUpLink(ref) });
    inlined.push(true);
  }

  edits.sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const edit of edits) {
    out += body.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  out += body.slice(cursor);
  return { body: out, inlined };
}

/** Index of the first eligible occurrence of `name`, or `undefined`. */
function findOccurrence(body: string, name: string, claimed: Uint8Array): number | undefined {
  if (name === '') return undefined;
  const re = new RegExp(escapeRegExp(name), 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const start = match.index;
    const end = start + name.length;
    re.lastIndex = start + 1;
    if (isWordChar(body[start - 1]) || isWordChar(body[end])) continue;
    if (overlaps(claimed, start, end)) continue;
    return start;
  }
  return undefined;
}

function overlaps(mask: Uint8Array, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (mask[i] === 1) return true;
  }
  return false;
}

function fillMask(mask: Uint8Array, start: number, end: number): void {
  for (let i = Math.max(0, start); i < Math.min(mask.length, end); i++) mask[i] = 1;
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_CODE_RE = /(`+)[\s\S]*?\1/g;
const LINK_RE = /\[[^\]\n]*\](?:\([^)\n]*\)|\{[^}\n]*\})/g;

/** Characters that must not be touched: fenced blocks, code spans, existing links. */
function protectedMask(body: string): Uint8Array {
  const mask = new Uint8Array(body.length);
  const plain: Array<[number, number]> = [];

  let segmentStart = 0;
  let inFence = false;
  let fenceChar = '';
  let fenceLength = 0;
  let offset = 0;
  for (const line of body.split('\n')) {
    const start = offset;
    const afterLine = Math.min(offset + line.length + 1, body.length);
    offset += line.length + 1;
    const fence = FENCE_RE.exec(line);
    if (!inFence) {
      if (fence) {
        plain.push([segmentStart, start]);
        inFence = true;
        fenceChar = fence[1]![0]!;
        fenceLength = fence[1]!.length;
        fillMask(mask, start, afterLine);
      }
      continue;
    }
    fillMask(mask, start, afterLine);
    if (fence && fence[1]![0] === fenceChar && fence[1]!.length >= fenceLength) {
      inFence = false;
      segmentStart = afterLine;
    }
  }
  if (!inFence) plain.push([segmentStart, body.length]);

  for (const [from, to] of plain) {
    const segment = body.slice(from, to);
    for (const re of [INLINE_CODE_RE, LINK_RE]) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(segment)) !== null) {
        fillMask(mask, from + match.index, from + match.index + match[0].length);
        if (match[0].length === 0) re.lastIndex++;
      }
    }
  }
  return mask;
}

// ---------------------------------------------------------------------------
// Plan

interface Usage {
  id: string;
  name: string;
  /** Summed across every step entry that references the component. */
  qty: number;
  /** Category of the first entry (parts before tools) of the first step to use it. */
  cat: string;
}

/** Steps of the first configured guide in `stepsForGuide` order, then the rest by `order`/`id`. */
function exportOrder(model: ProjectModel): Step[] {
  const first = model.config.guides[0];
  const inGuide = first ? stepsForGuide(model, first.id) : [];
  const seen = new Set(inGuide.map((s) => s.id));
  const rest = [...model.steps.values()]
    .filter((s) => !seen.has(s.id))
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : cmp(a.id, b.id)));
  return [...inGuide, ...rest];
}

function refsFor(model: ProjectModel, step: Step): { parts: BuildUpRef[]; tools: BuildUpRef[] } {
  const toRef = (entry: { component: string; qty: number; cat: string }): BuildUpRef => ({
    name: model.components.get(entry.component)?.name ?? entry.component,
    qty: entry.qty,
    cat: entry.cat,
  });
  return { parts: step.parts.map(toRef), tools: step.tools.map(toRef) };
}

/** Every component referenced by a step part or tool, in first-use order. */
function collectUsage(model: ProjectModel, steps: readonly Step[]): Usage[] {
  const usage = new Map<string, Usage>();
  for (const step of steps) {
    for (const entry of [...step.parts, ...step.tools]) {
      const existing = usage.get(entry.component);
      if (existing) {
        existing.qty += entry.qty;
        continue;
      }
      usage.set(entry.component, {
        id: entry.component,
        name: model.components.get(entry.component)?.name ?? entry.component,
        qty: entry.qty,
        cat: entry.cat,
      });
    }
  }
  return [...usage.values()];
}

function mediaLine(id: string, manifest: Media, model: ProjectModel): string {
  const heroes = manifest.hero.map((raw) => {
    const componentId = parsePin(raw)?.id ?? raw;
    return model.components.get(componentId)?.name ?? componentId;
  });
  return `- ${id}: ${manifest.type}, recorded ${manifest.shot_date} with ${heroes.join(', ')}`;
}

/** One BuildUp Markdown file for a step. */
function stepMarkdown(model: ProjectModel, step: Step): string {
  const { parts, tools } = refsFor(model, step);
  const { body, inlined } = substituteBuildUpLinks(step.body.trim(), [...parts, ...tools]);

  const sections: string[] = [`# ${step.title}`];
  if (body !== '') sections.push(body);

  const listedParts = parts.filter((_, i) => !inlined[i]);
  const listedTools = tools.filter((_, i) => !inlined[parts.length + i]);
  if (listedParts.length > 0) sections.push(`## Parts\n\n${listedParts.map(buildUpLink).map((l) => `- ${l}`).join('\n')}`);
  if (listedTools.length > 0) sections.push(`## Tools\n\n${listedTools.map(buildUpLink).map((l) => `- ${l}`).join('\n')}`);

  const mediaLines: string[] = [];
  for (const id of step.media ?? []) {
    const manifest = model.media.get(id);
    if (manifest) mediaLines.push(mediaLine(id, manifest, model));
  }
  if (mediaLines.length > 0) sections.push(`## Media\n\n${mediaLines.join('\n')}`);

  return `${sections.join('\n\n')}\n`;
}

function indexMarkdown(model: ProjectModel, steps: readonly Step[], usage: readonly Usage[]): string {
  const title = model.config.project?.title ?? model.config.guides[0]?.title ?? '';
  let out = `# ${title}\n\n`;
  for (const step of steps) out += `- [${step.title}](${step.id}.md)\n`;
  out += '\n## Bill of materials\n\n';
  for (const item of [...usage].sort((a, b) => cmp(a.id, b.id))) {
    out += `- ${buildUpLink(item)}\n`;
  }
  return out;
}

function okhManifest(model: ProjectModel, usage: readonly Usage[]): string {
  const project = model.config.project;
  const doc: YamlMapping = {};
  doc.okhv = 'OKH-LOSHv1.0';
  put(doc, 'name', project?.title ?? model.config.guides[0]?.title);
  put(doc, 'repo', project?.repo);
  put(doc, 'version', project?.version);
  if (project?.licence !== undefined) doc.license = { hardware: project.licence };
  put(doc, 'licensor', project?.licensor);
  put(doc, 'description', project?.description);
  put(doc, 'function', project?.function);
  put(doc, 'documentation-home', project?.documentation_home);
  doc['documentation-language'] = 'en';

  const sorted = [...usage].sort((a, b) => cmp(a.id, b.id));
  const bom: YamlMapping[] = [];
  const manufacturing = new Set<string>();
  for (const item of sorted) {
    const component: Component | undefined = model.components.get(item.id);
    const entry: YamlMapping = { name: item.name, id: item.id, quantity: item.qty, category: item.cat };
    put(entry, 'license', component?.licence);
    put(entry, 'source', component?.source_files[0]);
    const derived = component?.derived_files ?? [];
    if (derived.length > 0) entry.export = [...derived];
    for (const file of derived) manufacturing.add(file);
    bom.push(entry);
  }
  if (bom.length > 0) doc.bom = bom;
  if (manufacturing.size > 0) doc['manufacturing-files'] = [...manufacturing].sort(cmp);

  return emitYaml(doc);
}

function put(map: YamlMapping, key: string, value: string | undefined): void {
  if (value !== undefined) map[key] = value;
}

/** Build the whole export plan from the model. Pure and deterministic. */
export function buildExportPlan(model: ProjectModel): ExportPlan {
  const steps = exportOrder(model);
  const usage = collectUsage(model, steps);
  const buildup: ExportFile[] = [
    { path: `${EXPORT_OUTPUT_DIR}/buildup/index.md`, content: indexMarkdown(model, steps, usage) },
    ...steps.map((step) => ({ path: `${EXPORT_OUTPUT_DIR}/buildup/${step.id}.md`, content: stepMarkdown(model, step) })),
  ];
  return {
    version: EXPORT_PLAN_VERSION,
    buildup,
    okh: { path: `${EXPORT_OUTPUT_DIR}/okh/okh.yml`, content: okhManifest(model, usage) },
  };
}

// ---------------------------------------------------------------------------
// YAML emitter

export type YamlScalar = string | number | boolean;
export interface YamlMapping {
  [key: string]: YamlValue | undefined;
}
export type YamlValue = YamlScalar | YamlValue[] | YamlMapping;

/**
 * Deterministic YAML writer for the small subset this package emits, so the
 * manifest is byte-stable across dependency upgrades.
 *
 * Supported: string, number and boolean scalars; mappings with string keys in
 * insertion order; block sequences of scalars or mappings; 2-space indent.
 * Nothing else — no anchors, no flow style, no comments, no multi-line block
 * scalars, no `null`. Mapping entries whose value is `undefined` are skipped.
 * The document always ends with a single newline.
 */
export function emitYaml(value: YamlValue): string {
  if (isScalar(value)) return `${scalarText(value)}\n`;
  if (Array.isArray(value)) return emitSequence(value, 0);
  return emitMapping(value, 0);
}

function isScalar(value: unknown): value is YamlScalar {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function emitMapping(map: YamlMapping, indent: number): string {
  const pad = ' '.repeat(indent);
  let out = '';
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    const name = quoteIfNeeded(key);
    if (isScalar(value)) out += `${pad}${name}: ${scalarText(value)}\n`;
    else if (Array.isArray(value)) out += `${pad}${name}:\n${emitSequence(value, indent + 2)}`;
    else out += `${pad}${name}:\n${emitMapping(value, indent + 2)}`;
  }
  return out;
}

function emitSequence(items: readonly YamlValue[], indent: number): string {
  const pad = ' '.repeat(indent);
  let out = '';
  for (const item of items) {
    if (isScalar(item)) out += `${pad}- ${scalarText(item)}\n`;
    else if (Array.isArray(item)) out += `${pad}-\n${emitSequence(item, indent + 2)}`;
    else out += `${pad}- ${emitMapping(item, indent + 2).slice(indent + 2)}`;
  }
  return out;
}

function scalarText(value: YamlScalar): string {
  return typeof value === 'string' ? quoteIfNeeded(value) : String(value);
}

const QUOTE_LEADING_RE = /^[-?:,[\]{}#&*!|>'"%@`]/;
const NON_STRING_RE = /^(?:true|false|yes|no|on|off|null|~)$/i;
const NUMERIC_RE = /^[-+]?(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d+|\d*\.\d+|\d+\.)(?:[eE][-+]?\d+)?)$/;
const INFINITY_RE = /^[-+]?\.(?:inf|nan)$/i;

/** True when the plain form would not round-trip as this exact string. */
function needsQuotes(value: string): boolean {
  return (
    value === '' ||
    value.includes('\n') ||
    value.includes(': ') ||
    value.includes(' #') ||
    /^[ \t]/.test(value) ||
    /[ \t]$/.test(value) ||
    QUOTE_LEADING_RE.test(value) ||
    NON_STRING_RE.test(value) ||
    NUMERIC_RE.test(value) ||
    INFINITY_RE.test(value)
  );
}

function quoteIfNeeded(value: string): string {
  if (!needsQuotes(value)) return value;
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
