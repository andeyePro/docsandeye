/**
 * Components a step lists but never names. A step's `parts:` and `tools:`
 * are its bill of materials; the body is what the reader follows, so a part
 * the body never mentions is usually one the author forgot to explain (or a
 * stale entry). Pure, over a loaded model: `docsandeye check` reports each
 * finding as a warning, with or without `--dist`.
 */
import { sortProblems, type Problem } from './errors.js';
import { stepFilePath } from './links.js';
import type { ProjectModel } from './load.js';

/** Letters, digits and `_`: what may not touch a mention on either side. */
const WORD_CHAR = '[\\p{L}\\p{N}_]';

/**
 * A case-insensitive, whole-word matcher for `phrase`: any run of whitespace
 * in it matches any other, and with `kebab` (for an id) each hyphen matches a
 * hyphen or whitespace, so `m3-bolt` finds "M3 bolt".
 */
export function mentionPattern(phrase: string, kebab = false): RegExp {
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = phrase.trim().split(kebab ? /[\s-]+/ : /\s+/).map(escape);
  return new RegExp(`(?<!${WORD_CHAR})${words.join(kebab ? '[\\s-]+' : '\\s+')}(?!${WORD_CHAR})`, 'iu');
}

/**
 * Words in a name that carry no identity on their own (units, joiners, sizes), so "1/4" BSP
 * adapter" is recognised by "adapter", not by "BSP".
 */
const WEAK_WORDS = new Set([
  'with', 'from', 'male', 'female', 'long', 'thick', 'wide', 'inch', 'inches', 'diameter', 'length',
  'blue', 'black', 'white', 'clear', 'small', 'large', 'spare', 'kit', 'unit', 'units', 'part', 'parts',
  'tube', 'tubes', 'wire', 'wires', 'wiring', 'cable', 'cables', 'plate', 'screw', 'screws', 'bolt', 'bolts',
]);

/** A word of a name worth matching on its own: four or more letters, not a size or a joiner. */
export function keyWords(name: string): string[] {
  return name
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => /^\p{L}{4,}$/u.test(w) && !WEAK_WORDS.has(w.toLowerCase()));
}

/**
 * True when `text` names the component: the whole name or id as words (ignoring case), or,
 * because authors say "the regulator" for "CO₂ regulator" and "filters" for "vent filter",
 * any key word of the name at the start of a word in the text.
 */
export function mentionsComponent(text: string, component: { id: string; name: string }): boolean {
  if (mentionPattern(component.name).test(text) || mentionPattern(component.id, true).test(text)) return true;
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return keyWords(component.name).some((w) => new RegExp(`(?<!${WORD_CHAR})${escape(w)}`, 'iu').test(text));
}

/**
 * One warning per `parts:` entry whose component the step's body never
 * mentions. HTML comments (a reader never sees them) are ignored; the
 * text of `<!-- when … -->` blocks counts. A part with `cat: prev` (made in an
 * earlier step) is exempt, as is a reference to an unknown component (already
 * an error). Sorted by file, then path.
 */
export function unmentionedComponents(model: ProjectModel): Problem[] {
  const out: Problem[] = [];
  for (const step of model.steps.values()) {
    const text = (step.body ?? '').replace(/<!--[\s\S]*?(-->|$)/g, ' ');
    const file = stepFilePath(step.id);
    // Tools are listed to be laid out beforehand, not narrated; only parts must appear in the text.
    const lists = [['parts', step.parts]] as const;
    for (const [field, items] of lists) {
      items.forEach((item, i) => {
        if (item.cat === 'prev') return;
        const component = model.components.get(item.component);
        if (!component || mentionsComponent(text, component)) return;
        out.push({
          code: 'schema',
          file,
          path: `${field}.${i}.component`,
          message: `${field === 'parts' ? 'part' : 'tool'} "${component.name}" (${component.id}) is never mentioned in the step body`,
        });
      });
    }
  }
  return sortProblems(out);
}
