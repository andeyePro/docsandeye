/**
 * Reader-interactive guides: the pure logic shared by the build (core's
 * loader and the Starlight plugin) and the browser (the plugin's custom
 * elements bundle this module as `@docsandeye/core/interactive`).
 *
 * No imports and no DOM: every function here takes plain data and returns
 * plain data, so it runs unchanged in Node, in unit tests and in a page.
 *
 * - `matchesWhen` decides whether a `when` condition holds for a profile.
 * - `wrapWhenBlocks` turns `<!-- when … -->` … `<!-- /when -->` comment pairs
 *   in a step body into labelled `<div class="docsi-when">` blocks.
 * - `computeReceipt`, `missingParts` and the mailto builders are the maths
 *   and text behind the receipt checklist and the step checks.
 */

// ---------------------------------------------------------------------------
// Shapes

export const PROFILE_TYPES = ['number', 'boolean', 'choice'] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

export interface ProfileOption {
  value: string;
  /** May contain Markdown links `[text](url)` (only that syntax); see `labelParts`. */
  label: string;
  /** Other profile items this choice settles, `{<profile id>: <value>}`: their questions are hidden and their values set. */
  implies?: Profile;
  /** A link option: rendered as a link that navigates, never a radio; it never becomes the item's value. */
  href?: string;
}

/** One reader question, as validated and defaulted by the config schema. */
export interface ProfileItem {
  id: string;
  type: ProfileType;
  label: string;
  default: ProfileValue;
  /** number only */
  min?: number;
  /** number only */
  max?: number;
  /** choice only */
  options?: ProfileOption[];
  /** Short name for summaries and "Only with …" labels. */
  short?: string;
  /** number only: unit names for "3 Pioreactors" (default the id). */
  unit_label?: string;
  unit_label_plural?: string;
  /** The guides the question belongs to; absent = every guide. */
  guides?: string[];
}

export type ProfileValue = number | boolean | string;
/** The reader's answers, keyed by profile id. */
export type Profile = Record<string, ProfileValue>;

export type WhenScalar = string | number | boolean;
/** `{<profile id>: <value> | [<values>]}`: every key must match (AND); a list matches any of its values (OR). */
export type When = Record<string, WhenScalar | WhenScalar[]>;

export interface Contact {
  name: string;
  email?: string;
  subject?: string;
}

export interface ReceiptConfig {
  /** A number-type profile id; per-unit quantities are multiplied by it. */
  multiply_by?: string;
  /** A choice-type profile id naming who the reader bought from. */
  supplier_from?: string;
}

/** One component with `receipt` data, flattened for the checklist (serialisable). */
export interface ReceiptItem {
  component: string;
  name: string;
  per: 'unit' | 'kit';
  qty: number;
  /** Choice values of `supplier_from` whose package contains this part; absent = all. */
  from?: string[];
  /** Choice values of `supplier_from` whose kit ships this part already fitted into a larger one; those readers do not count it. */
  fitted?: string[];
  when?: When;
  note?: string;
  supplier?: { name: string; url?: string };
}

export interface ReceiptRow extends ReceiptItem {
  /** `qty × units` for `per: unit`, `qty` for `per: kit`. */
  expected: number;
}

export interface Receipt {
  /** Value of the `multiply_by` profile item (1 when unset). */
  units: number;
  /** Value of the `supplier_from` profile item, when configured. */
  supplier?: string;
  perUnit: ReceiptRow[];
  perKit: ReceiptRow[];
  /** Rows whose `from` excludes the reader's supplier: "not in your package". */
  elsewhere: ReceiptRow[];
}

// ---------------------------------------------------------------------------
// Conditions

const COMPARATOR_RE = /^\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/;

/** `">=2"` → `{op: '>=', value: 2}`; undefined when the string is not a comparator. */
export function parseComparator(value: string): { op: '>=' | '<=' | '>' | '<'; value: number } | undefined {
  const m = COMPARATOR_RE.exec(value);
  if (!m) return undefined;
  return { op: m[1] as '>=' | '<=' | '>' | '<', value: Number(m[2]) };
}

function matchesValue(expected: WhenScalar, actual: ProfileValue | undefined): boolean {
  if (actual === undefined) return false;
  if (typeof expected === 'string' && typeof actual === 'number') {
    const cmp = parseComparator(expected);
    if (cmp) {
      switch (cmp.op) {
        case '>=':
          return actual >= cmp.value;
        case '<=':
          return actual <= cmp.value;
        case '>':
          return actual > cmp.value;
        case '<':
          return actual < cmp.value;
      }
    }
  }
  return expected === actual;
}

/**
 * True when every key of `when` matches `profile` (AND); a list value matches
 * when any entry does (OR). Numbers match exactly or through a string
 * comparator (`">=2"`, `"<2"`, `">1"`, `"<=3"`). No condition → true; a key
 * the profile lacks → false.
 */
export function matchesWhen(when: When | undefined | null, profile: Profile): boolean {
  if (!when) return true;
  for (const [key, expected] of Object.entries(when)) {
    const actual = profile[key];
    const values = Array.isArray(expected) ? expected : [expected];
    if (!values.some((v) => matchesValue(v, actual))) return false;
  }
  return true;
}

/**
 * Problems with a `when` against the configured profile: unknown ids, values
 * of the wrong type, choice values that are not options, malformed
 * comparators. Paths are relative to the `when` mapping (`temp-kit`, `units.1`).
 */
export function validateWhen(when: When, items: readonly ProfileItem[]): Array<{ path: string; message: string }> {
  const out: Array<{ path: string; message: string }> = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const [key, raw] of Object.entries(when)) {
    const item = byId.get(key);
    if (!item) {
      const known = items.map((i) => i.id).join(', ') || 'none';
      out.push({ path: key, message: `unknown profile id "${key}" (profile ids: ${known})` });
      continue;
    }
    const values = Array.isArray(raw) ? raw : [raw];
    values.forEach((value, i) => {
      const at = Array.isArray(raw) ? `${key}.${i}` : key;
      const problem = valueProblem(item, value);
      if (problem) out.push({ path: at, message: problem });
    });
  }
  return out;
}

function valueProblem(item: ProfileItem, value: WhenScalar): string | undefined {
  switch (item.type) {
    case 'boolean':
      return typeof value === 'boolean' ? undefined : `"${item.id}" is a boolean profile item: use true or false`;
    case 'number':
      if (typeof value === 'number') return Number.isFinite(value) ? undefined : `"${item.id}" needs a finite number`;
      if (typeof value === 'string' && parseComparator(value)) return undefined;
      return `"${item.id}" is a number profile item: use a number or a comparator such as ">=2"`;
    case 'choice': {
      const values = choosableOptions(item).map((o) => o.value);
      if (typeof value === 'string' && values.includes(value)) return undefined;
      return `"${String(value)}" is not an option of "${item.id}" (options: ${values.join(', ')})`;
    }
  }
}

const COMPARATOR_SYMBOL: Record<string, string> = { '>=': '≥', '<=': '≤', '>': '>', '<': '<' };

/** `3 Pioreactors` / `1 Pioreactor`: a number with the item's unit labels (the id when it has none). */
export function formatCount(item: Pick<ProfileItem, 'id' | 'unit_label' | 'unit_label_plural'>, value: number | string): string {
  const one = item.unit_label ?? item.id;
  const many = item.unit_label_plural ?? item.unit_label ?? item.id;
  return `${value} ${Number(value) === 1 ? one : many}`;
}

function describeValue(item: ProfileItem | undefined, value: WhenScalar): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (item?.type === 'choice') {
    const label = item.options?.find((o) => o.value === value)?.label;
    return label !== undefined ? plainLabel(label) : String(value);
  }
  return String(value);
}

/** `2 or more Pioreactors`, `fewer than 3 Pioreactors` (always the plural). */
function countComparison(item: ProfileItem, op: '>=' | '<=' | '>' | '<', value: number): string {
  const plural = item.unit_label_plural ?? item.unit_label ?? item.id;
  const words = { '>=': `${value} or more`, '<=': `${value} or fewer`, '>': `more than ${value}`, '<': `fewer than ${value}` };
  return `${words[op]} ${plural}`;
}

function hasUnits(item: ProfileItem | undefined): item is ProfileItem {
  return item?.type === 'number' && (item.unit_label !== undefined || item.unit_label_plural !== undefined);
}

/**
 * Human text for a condition, clauses joined with "and". A boolean item with
 * a `short` label reads `with <short>` / `without <short>`; a number item
 * with unit labels reads `3 Pioreactors` or `≥ 2 Pioreactors`; otherwise
 * `<name>: <values>` with choice values as their option labels and the name
 * the item's `short` (else its id): `temp-kit: yes and supplier: LabCrafter
 * kit or Pioreactor (direct) and units ≥ 2`.
 */
export function describeWhen(when: When, items: readonly ProfileItem[] = []): string {
  const byId = new Map(items.map((i) => [i.id, i]));
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(when)) {
    const item = byId.get(key);
    const values = Array.isArray(raw) ? raw : [raw];
    const name = item?.short ?? key;
    if (item?.type === 'boolean' && item.short !== undefined && values.length === 1 && typeof values[0] === 'boolean') {
      parts.push(`${values[0] ? 'with' : 'without'} ${item.short}`);
      continue;
    }
    const comparators = values.filter((v): v is string => typeof v === 'string' && parseComparator(v) !== undefined && item?.type !== 'choice');
    if (comparators.length === values.length && comparators.length > 0) {
      parts.push(
        comparators
          .map((c) => {
            const cmp = parseComparator(c)!;
            return hasUnits(item) ? countComparison(item, cmp.op, cmp.value) : `${name} ${COMPARATOR_SYMBOL[cmp.op]} ${cmp.value}`;
          })
          .join(' or '),
      );
      continue;
    }
    if (hasUnits(item) && values.every((v) => typeof v === 'number')) {
      parts.push(values.map((v) => formatCount(item, v as number)).join(' or '));
      continue;
    }
    parts.push(`${name}: ${values.map((v) => describeValue(item, v)).join(' or ')}`);
  }
  return parts.join(' and ');
}

// ---------------------------------------------------------------------------
// Profile values

/** The options a reader can choose: every option except link (`href`) options. */
export function choosableOptions(item: Pick<ProfileItem, 'options'>): ProfileOption[] {
  return (item.options ?? []).filter((o) => o.href === undefined);
}

/**
 * Apply choice implications: for each choice item in order, the chosen
 * option's `implies` overrides the named items' values. Later items win on
 * conflicts, and an implied choice's own implications apply when that item
 * comes later in the order. Values not implied are kept as given (so
 * switching to an option without implications restores the question with
 * whatever value it last held). Returns a new profile.
 */
export function effectiveProfile(items: readonly ProfileItem[], answers: Profile): Profile {
  const out: Profile = { ...answers };
  for (const [id, , value] of implications(items, out)) out[id] = value;
  return out;
}

/** `{<implied id>: <id of the choice item that implies it>}` for a profile: the questions to hide. */
export function impliedItems(items: readonly ProfileItem[], answers: Profile): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, by] of implications(items, { ...answers })) out[id] = by;
  return out;
}

/** Walk the items in order, applying each chosen option's `implies` to `profile` as it goes. */
function implications(items: readonly ProfileItem[], profile: Profile): Array<[string, string, ProfileValue]> {
  const known = new Set(items.map((i) => i.id));
  const out: Array<[string, string, ProfileValue]> = [];
  for (const item of items) {
    if (item.type !== 'choice') continue;
    const option = choosableOptions(item).find((o) => o.value === profile[item.id]);
    for (const [id, value] of Object.entries(option?.implies ?? {})) {
      if (!known.has(id) || id === item.id) continue;
      profile[id] = value;
      out.push([id, item.id, value]);
    }
  }
  return out;
}

/**
 * Problems with the `implies` of every choice option, paths relative to the
 * profile list (`2.options.0.implies.temp-kit`): unknown or self ids, values
 * not valid for the implied item (numbers must be integers in range; choice
 * values must be choosable options), `implies` on a link option.
 */
export function impliesProblems(items: readonly ProfileItem[]): Array<{ path: string; message: string }> {
  const out: Array<{ path: string; message: string }> = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  items.forEach((item, i) => {
    (item.options ?? []).forEach((option, j) => {
      if (option.implies === undefined) return;
      const at = `${i}.options.${j}.implies`;
      if (option.href !== undefined) {
        out.push({ path: at, message: 'a link option (href) cannot imply other answers' });
        return;
      }
      for (const [id, value] of Object.entries(option.implies)) {
        const target = byId.get(id);
        if (!target) {
          out.push({ path: `${at}.${id}`, message: `unknown profile id "${id}" (profile ids: ${items.map((x) => x.id).join(', ')})` });
          continue;
        }
        if (id === item.id) {
          out.push({ path: `${at}.${id}`, message: 'an option cannot imply its own item' });
          continue;
        }
        const problem =
          target.type === 'number'
            ? typeof value === 'number' && Number.isInteger(value) && value >= (target.min ?? 1) && value <= (target.max ?? 100)
              ? undefined
              : `"${id}" is a number profile item: use an integer from ${target.min ?? 1} to ${target.max ?? 100}`
            : valueProblem(target, value);
        if (problem) out.push({ path: `${at}.${id}`, message: problem });
      }
    });
  });
  return out;
}

/** Defaults for every item, with the default choices' implications applied. */
export function defaultProfile(items: readonly ProfileItem[]): Profile {
  const out: Profile = {};
  for (const item of items) out[item.id] = item.default;
  return effectiveProfile(items, out);
}

/**
 * Coerce stored or form answers to a valid profile: unknown keys dropped,
 * numbers rounded and clamped to `[min, max]`, anything else invalid (a link
 * option included) replaced by the item's default; then implications applied
 * (`effectiveProfile`). Never throws.
 */
export function normaliseProfile(items: readonly ProfileItem[], raw: unknown): Profile {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Profile = {};
  for (const item of items) {
    const value = source[item.id];
    out[item.id] = item.default;
    if (item.type === 'number') {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
      if (Number.isFinite(n)) {
        const min = item.min ?? 1;
        const max = item.max ?? 100;
        out[item.id] = Math.min(max, Math.max(min, Math.round(n)));
      }
    } else if (item.type === 'boolean') {
      if (typeof value === 'boolean') out[item.id] = value;
      else if (value === 'true' || value === 'on') out[item.id] = true;
      else if (value === 'false') out[item.id] = false;
    } else if (typeof value === 'string' && choosableOptions(item).some((o) => o.value === value)) {
      out[item.id] = value;
    }
  }
  return effectiveProfile(items, out);
}

/** Parse a stored JSON string into a profile; malformed or absent → defaults. */
export function parseStoredProfile(items: readonly ProfileItem[], stored: string | null | undefined): Profile {
  if (!stored) return defaultProfile(items);
  try {
    return normaliseProfile(items, JSON.parse(stored));
  } catch {
    return defaultProfile(items);
  }
}

/** The questions that apply on a guide's pages: items without `guides`, and those listing the guide. */
export function itemsForGuide<T extends Pick<ProfileItem, 'guides'>>(items: readonly T[], guideId: string): T[] {
  return items.filter((item) => item.guides === undefined || item.guides.includes(guideId));
}

/**
 * The "Your setup" line, in human labels: `3 Pioreactors · temperature kit:
 * yes · LabCrafter kit`. A choice reads as its option label (plain text); a
 * boolean as its `short` (else its label) with yes/no; a number with its unit
 * labels (else its id).
 */
export function profileSummary(items: readonly ProfileItem[], profile: Profile): string {
  return items
    .map((item) => {
      const value = profile[item.id] ?? item.default;
      if (item.type === 'number') return formatCount(item, String(value));
      if (item.type === 'boolean') return `${plainLabel(item.short ?? item.label)}: ${value === true ? 'yes' : 'no'}`;
      const label = item.options?.find((o) => o.value === value)?.label;
      return label !== undefined ? plainLabel(label) : String(value);
    })
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Option labels

export interface LabelPart {
  text: string;
  /** Present for a `[text](url)` link. */
  href?: string;
}

const LABEL_LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

/** True for URLs a label link may carry: http(s), mailto, or scheme-less (relative, root-relative, fragment). */
export function isSafeHref(url: string): boolean {
  const scheme = SCHEME_RE.exec(url)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === 'http' || scheme === 'https' || scheme === 'mailto';
}

/**
 * Split an option label into text and `[text](url)` links, the only Markdown
 * a label understands. A link with an unsafe URL (another scheme) stays as its text.
 */
export function labelParts(label: string): LabelPart[] {
  const out: LabelPart[] = [];
  let last = 0;
  for (const m of label.matchAll(LABEL_LINK_RE)) {
    const [whole, text, href] = m as unknown as [string, string, string];
    if (m.index > last) out.push({ text: label.slice(last, m.index) });
    out.push(isSafeHref(href) ? { text, href } : { text });
    last = m.index + whole.length;
  }
  if (last < label.length) out.push({ text: label.slice(last) });
  // Merge neighbouring text parts (an unsafe link next to plain text).
  return out.reduce<LabelPart[]>((acc, part) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.href === undefined && part.href === undefined) prev.text += part.text;
    else acc.push({ ...part });
    return acc;
  }, []);
}

/** A label with its Markdown links reduced to their text (for summaries and "Only if" text). */
export function plainLabel(label: string): string {
  return labelParts(label)
    .map((p) => p.text)
    .join('');
}

/** localStorage keys, one per guide. */
export const STORAGE_KEYS = {
  profile: (guideId: string) => `docsandeye:profile:${guideId}`,
  receipt: (guideId: string) => `docsandeye:receipt:${guideId}`,
  checks: (guideId: string) => `docsandeye:checks:${guideId}`,
  /** Check-offs ("have it" / "done") of parts, tools and receipt rows, keyed by `checkoffKey`. */
  parts: (guideId: string) => `docsandeye:parts:${guideId}`,
} as const;

/** The key of one check-off within `STORAGE_KEYS.parts`: step id + component. */
export function checkoffKey(stepId: string, component: string): string {
  return `${stepId}/${component}`;
}

/** The checked keys of a stored check-off record (`{<key>: true}`); anything else is unchecked. */
export function checkedKeys(record: Record<string, unknown>): Set<string> {
  return new Set(Object.keys(record).filter((k) => record[k] === true));
}

/** A new check-off record with `key` set or cleared (cleared keys are removed, not stored as false). */
export function setCheckoff(record: Record<string, unknown>, key: string, checked: boolean): Record<string, unknown> {
  const out = { ...record };
  if (checked) out[key] = true;
  else delete out[key];
  return out;
}

// ---------------------------------------------------------------------------
// Saving consent

/** `yes`: saved in this browser; `no`: the reader declined (kept for the visit only); `unasked`: no decision yet. */
export type ConsentState = 'yes' | 'no' | 'unasked';

/** The one localStorage key written before consent is given: the consent itself, and only once it is `yes`. */
export const CONSENT_KEY = 'docsandeye:consent';
/** sessionStorage flag for "Hide this for now" on the not-saved notice. */
export const CONSENT_NOTICE_HIDDEN_KEY = 'docsandeye:consent-notice-hidden';

/** Stored consent value → state (`no` is never stored, so anything but `yes` is unasked). */
export function parseConsent(stored: string | null | undefined): ConsentState {
  return stored === 'yes' ? 'yes' : 'unasked';
}

/**
 * What the consent UI shows: the bottom bar only once the reader has changed
 * something and has not decided; the not-saved notice only after "Don't
 * save", until hidden.
 */
export function consentView(state: ConsentState, changed: boolean, noticeHidden: boolean): { bar: boolean; notice: boolean } {
  return { bar: state === 'unasked' && changed, notice: state === 'no' && !noticeHidden };
}

// ---------------------------------------------------------------------------
// Body `when` comments

export interface WhenBlockProblem {
  /** 1-based line within the body. */
  line: number;
  message: string;
}

const OPEN_RE = /^\s*<!--\s*when\s+(.*?)\s*-->\s*$/;
// `when` as a whole word followed by space or the comment end: `<!-- when-ready: … -->` is an ordinary comment.
const OPEN_LOOSE_RE = /^\s*<!--\s*when(?:\s|-->)/;
const CLOSE_RE = /^\s*<!--\s*\/when\s*-->\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;
const TOKEN_RE = /^([a-z0-9]+(?:-[a-z0-9.]+)*)(>=|<=|=|>|<)(.+)$/;

/**
 * Parse the condition text of a `<!-- when … -->` comment against the
 * profile: `temp-kit=true`, `supplier=labcrafter,pioreactor`, `units>=2`;
 * several space-separated conditions are ANDed.
 */
export function parseWhenComment(text: string, items: readonly ProfileItem[]): { when?: When; error?: string } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { error: 'empty condition' };
  const byId = new Map(items.map((i) => [i.id, i]));
  const when: When = {};
  for (const token of tokens) {
    const m = TOKEN_RE.exec(token);
    if (!m) return { error: `cannot read condition "${token}" (use id=value, id=a,b or id>=n)` };
    const [, id, op, rest] = m as unknown as [string, string, string, string];
    const item = byId.get(id);
    if (!item) return { error: `unknown profile id "${id}"` };
    if (op !== '=') {
      if (item.type !== 'number') return { error: `"${id}" is not a number profile item; "${op}" needs one` };
      const comparator = `${op}${rest}`;
      if (!parseComparator(comparator)) return { error: `"${token}" needs a number after "${op}"` };
      when[id] = comparator;
      continue;
    }
    const values: WhenScalar[] = [];
    for (const raw of rest.split(',').filter((v) => v !== '')) {
      let value: WhenScalar = raw;
      if (item.type === 'boolean') {
        if (raw !== 'true' && raw !== 'false') return { error: `"${id}" is a boolean profile item: use ${id}=true or ${id}=false` };
        value = raw === 'true';
      } else if (item.type === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n)) return { error: `"${id}" is a number profile item: "${raw}" is not a number` };
        value = n;
      }
      const problem = valueProblem(item, value);
      if (problem) return { error: problem };
      values.push(value);
    }
    if (values.length === 0) return { error: `"${token}" has no value` };
    when[id] = values.length === 1 ? values[0]! : values;
  }
  return { when };
}

/** Escape text for an HTML text node or a quoted attribute value. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** `Only with the temperature kit` when the condition opens with a `with`/`without` clause, else `Only if: <human text>`. */
export function whenLabel(when: When, items: readonly ProfileItem[]): string {
  const text = describeWhen(when, items);
  return /^with(out)? /.test(text) ? `Only ${text}` : `Only if: ${text}`;
}

/**
 * Wrap every `<!-- when … -->` … `<!-- /when -->` pair (each comment on its
 * own line, outside fenced code) in
 * `<div class="docsi-when" data-when='<json>'>` with a visible
 * `<p class="docsi-when-label">Only if: …</p>`, leaving the enclosed Markdown
 * to the Markdown renderer.
 *
 * Structural problems (a nested open, a stray close, an unclosed block) leave
 * the whole body unwrapped; a block whose condition cannot be read is left
 * unwrapped on its own. Either way the problem is returned with its line, and
 * the text itself is always kept.
 */
export function wrapWhenBlocks(body: string, items: readonly ProfileItem[]): { markdown: string; problems: WhenBlockProblem[] } {
  const lines = body.split('\n');
  const problems: WhenBlockProblem[] = [];
  interface Block {
    open: number;
    close: number;
    when?: When;
  }
  const blocks: Block[] = [];
  let current: Block | undefined;
  let fence: string | undefined;
  let structural = false;

  lines.forEach((line, i) => {
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      if (fence === undefined) fence = fenceMatch[1];
      else if (fenceMatch[1] === fence) fence = undefined;
      return;
    }
    if (fence !== undefined) return;
    const lineNo = i + 1;
    if (CLOSE_RE.test(line)) {
      if (!current) {
        problems.push({ line: lineNo, message: '<!-- /when --> without a matching <!-- when … -->' });
        structural = true;
        return;
      }
      current.close = i;
      blocks.push(current);
      current = undefined;
      return;
    }
    const open = OPEN_RE.exec(line);
    if (open || OPEN_LOOSE_RE.test(line)) {
      if (current) {
        problems.push({ line: lineNo, message: `nested <!-- when … --> (the block opened on line ${current.open + 1} is still open; when blocks do not nest)` });
        structural = true;
        return;
      }
      current = { open: i, close: -1 };
      if (!open) {
        problems.push({ line: lineNo, message: 'a when comment must be on its own line: <!-- when id=value -->' });
        return;
      }
      const parsed = parseWhenComment(open[1] ?? '', items);
      if (parsed.error) problems.push({ line: lineNo, message: `when condition: ${parsed.error}` });
      else current.when = parsed.when;
    }
  });
  if (current) {
    problems.push({ line: current.open + 1, message: '<!-- when … --> is never closed with <!-- /when -->' });
    structural = true;
  }
  if (structural || blocks.length === 0) return { markdown: body, problems };

  const out = [...lines];
  for (const block of blocks) {
    if (!block.when) continue;
    const json = escapeHtml(JSON.stringify(block.when));
    // Keep the comment's indentation (a block inside a list item stays in
    // it), and end with a blank line after `</div>`: a raw HTML block runs
    // until a blank line, so Markdown directly under `<!-- /when -->` would
    // otherwise render as literal text.
    const indent = /^[ \t]*/.exec(lines[block.open] ?? '')?.[0] ?? '';
    const closeIndent = /^[ \t]*/.exec(lines[block.close] ?? '')?.[0] ?? '';
    out[block.open] = `${indent}<div class="docsi-when" data-when="${json}">\n${indent}<p class="docsi-when-label">${escapeHtml(whenLabel(block.when, items))}</p>\n`;
    out[block.close] = `\n${closeIndent}</div>\n`;
  }
  return { markdown: out.join('\n'), problems };
}

// ---------------------------------------------------------------------------
// Receipt checklist

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The checklist for a profile: rows failing `when` dropped; the rest split
 * into per-unit and per-kit groups, with rows whose `from` excludes the
 * reader's supplier moved to `elsewhere`, and rows `fitted` by that supplier
 * (built into a larger part in its kit) left out. Each group is ordered by component
 * name, then id.
 */
export function computeReceipt(items: readonly ReceiptItem[], profile: Profile, config: ReceiptConfig = {}): Receipt {
  const rawUnits = config.multiply_by ? profile[config.multiply_by] : undefined;
  const units = typeof rawUnits === 'number' && Number.isFinite(rawUnits) ? rawUnits : 1;
  const rawSupplier = config.supplier_from ? profile[config.supplier_from] : undefined;
  const supplier = typeof rawSupplier === 'string' ? rawSupplier : undefined;
  const receipt: Receipt = { units, perUnit: [], perKit: [], elsewhere: [] };
  if (supplier !== undefined) receipt.supplier = supplier;

  const sorted = [...items].sort((a, b) => compareText(a.name, b.name) || compareText(a.component, b.component));
  for (const item of sorted) {
    if (!matchesWhen(item.when, profile)) continue;
    if (supplier !== undefined && item.fitted?.includes(supplier)) continue;
    const row: ReceiptRow = { ...item, expected: item.per === 'kit' ? item.qty : item.qty * units };
    if (supplier !== undefined && item.from !== undefined && !item.from.includes(supplier)) receipt.elsewhere.push(row);
    else if (item.per === 'kit') receipt.perKit.push(row);
    else receipt.perUnit.push(row);
  }
  return receipt;
}

export interface MissingPart {
  component: string;
  name: string;
  missing: number;
  expected: number;
  received: number;
  supplierUrl?: string;
}

/**
 * Parts received short of expectation, from the per-unit and per-kit groups
 * (the `elsewhere` group is sourced by the reader, so never "missing").
 * An absent or invalid received count means "all of them". Components in
 * `done` (rows the reader ticked "have it") are never missing.
 */
export function missingParts(receipt: Receipt, received: Record<string, unknown>, done: ReadonlySet<string> = new Set()): MissingPart[] {
  const out: MissingPart[] = [];
  for (const row of [...receipt.perUnit, ...receipt.perKit]) {
    if (done.has(row.component)) continue;
    const raw = received[row.component];
    const got = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : row.expected;
    if (got >= row.expected) continue;
    const part: MissingPart = { component: row.component, name: row.name, missing: row.expected - got, expected: row.expected, received: got };
    if (row.supplier?.url) part.supplierUrl = row.supplier.url;
    out.push(part);
  }
  return out;
}

/** Longest mailto the builders produce (some mail clients truncate beyond ~2000). */
export const MAILTO_MAX_LENGTH = 1800;

function mailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface MissingMailtoInput {
  contact: Contact | undefined;
  missing: readonly MissingPart[];
  /** Units ordered (the `multiply_by` value), when the guide has one. */
  units?: number;
  pageUrl: string;
  maxLength?: number;
}

/**
 * `mailto:` to the supplier's contact listing each missing part as
 * `name × count`, the units ordered and the page URL, URL-encoded and kept
 * under `maxLength` by truncating the list with "and N more". Undefined when
 * the contact has no email (the page then shows supplier links instead).
 */
export function missingPartsMailto(input: MissingMailtoInput): string | undefined {
  const { contact, missing, units, pageUrl } = input;
  if (!contact?.email || missing.length === 0) return undefined;
  const max = input.maxLength ?? MAILTO_MAX_LENGTH;
  const subject = contact.subject ?? 'Missing parts';
  const lines = missing.map((m) => `- ${m.name} × ${m.missing}`);
  const build = (count: number): string => {
    const listed = lines.slice(0, count);
    if (count < lines.length) listed.push(`- and ${lines.length - count} more`);
    const body = [
      `Hello ${contact.name},`,
      '',
      'Some parts were missing from my package:',
      '',
      ...listed,
      '',
      ...(units !== undefined ? [`Units ordered: ${units}`] : []),
      `Guide page: ${pageUrl}`,
    ].join('\n');
    return mailto(contact.email!, subject, body);
  };
  for (let count = lines.length; count > 0; count--) {
    const href = build(count);
    if (href.length <= max) return href;
  }
  return build(0);
}

export interface CheckMailtoInput {
  contact: Contact | undefined;
  stepTitle: string;
  question: string;
  profileSummary: string;
  pageUrl: string;
  /** What the reader answered: the option they picked, or (the yes/no form, the default) "No". */
  answer?: string;
}

/** "Something else — contact us": subject plus step title; body names the step, question, setup and page. Undefined without an email. */
export function checkMailto(input: CheckMailtoInput): string | undefined {
  const { contact } = input;
  if (!contact?.email) return undefined;
  const subject = `${contact.subject ?? 'Help with a step'}: ${input.stepTitle}`;
  const body = [
    `Hello ${contact.name},`,
    '',
    `Step: ${input.stepTitle}`,
    `Check: ${input.question}`,
    `My answer: ${input.answer ?? 'No'}`,
    ...(input.profileSummary ? [`My setup: ${input.profileSummary}`] : []),
    `Page: ${input.pageUrl}`,
    '',
    'What I see:',
    '',
  ].join('\n');
  return mailto(contact.email, subject, body);
}

// ---------------------------------------------------------------------------
// Step checks and skipping

/**
 * A stored check answer: `yes` (a yes/no check answered Yes, or the correct
 * option picked), `no` (answered No), or `no:<token>` (the wrong option with
 * that `optionToken` picked). Only `yes` counts as checked.
 */
export type CheckAnswer = 'yes' | 'no' | `no:${string}`;

/** 32-bit FNV-1a of `text`, as 8 lower-case hex digits: an opaque, stable marker, not a secret. */
export function fnv1aHex(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The opaque marker of one option of a multiple-choice check (`data-option`); stable when options are reordered. */
export function optionToken(checkId: string, label: string): string {
  return fnv1aHex(`${checkId}\n${label}`);
}

/**
 * The opaque marker a multiple-choice check carries (`data-key`): a digest
 * of its correct option's token, so the page can tell a right pick from a
 * wrong one without naming the right one in plain view.
 */
export function answerKey(stepId: string, checkId: string, token: string): string {
  return fnv1aHex(`${stepId}/${checkId}/${token}`);
}

/** The value stored for a pick: `yes` when `token` is the correct one, `no:<token>` otherwise. */
export function optionAnswer(stepId: string, checkId: string, key: string, token: string): CheckAnswer {
  return answerKey(stepId, checkId, token) === key ? 'yes' : `no:${token}`;
}

/** The token of the wrong option a stored answer records; undefined for anything else. */
export function wrongPick(answer: unknown): string | undefined {
  return typeof answer === 'string' && answer.startsWith('no:') && answer.length > 3 ? answer.slice(3) : undefined;
}

export interface CheckRef {
  id: string;
  when?: When;
}

/** True when the step has at least one check visible for `profile` and every visible check is answered yes. */
export function checksComplete(checks: readonly CheckRef[], answers: Record<string, unknown> | undefined, profile: Profile): boolean {
  const visible = checks.filter((c) => matchesWhen(c.when, profile));
  return visible.length > 0 && visible.every((c) => answers?.[c.id] === 'yes');
}

export interface StepRef {
  title: string;
  href: string;
  when?: When;
}

/** The first of `candidates` (the steps after the current one, in order) that applies to `profile`. */
export function nextApplicableStep<S extends StepRef>(candidates: readonly S[], profile: Profile): S | undefined {
  return candidates.find((s) => matchesWhen(s.when, profile));
}

// ---------------------------------------------------------------------------
// YouTube

export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** `https://www.youtube.com/watch?v=<id>&t=<start>s` (no `t` without a start). */
export function youtubeWatchUrl(id: string, startS?: number): string {
  return `https://www.youtube.com/watch?v=${id}${startS !== undefined ? `&t=${startS}s` : ''}`;
}

/** The privacy-enhanced embed URL loaded only after a click. */
export function youtubeEmbedUrl(id: string, startS?: number, endS?: number): string {
  const params = ['autoplay=1'];
  if (startS !== undefined) params.push(`start=${startS}`);
  if (endS !== undefined) params.push(`end=${endS}`);
  params.push('rel=0');
  return `https://www.youtube-nocookie.com/embed/${id}?${params.join('&')}`;
}

/** `m:ss` for a duration in seconds. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
