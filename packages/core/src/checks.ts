/**
 * Multiple-choice step checks: where the correct option sits, and the
 * `docsandeye check` warning for the older yes/no form.
 *
 * Authors list the correct option anywhere. So that its position gives
 * nothing away, the loader reorders every option-form check of a guide
 * (`placeCheckOptions`): taking the guide's option checks with the same
 * number of options `n` in reading order, the i-th puts its correct option
 * at `(offset + i) mod n`, where `offset` is a fixed function of the guide
 * id. Every position is used in turn, the first check of a guide is not
 * always "first", and the same content always gives the same order. Wrong
 * options keep their relative order.
 *
 * Pure: no filesystem, no clock.
 */
import { sortProblems, type Problem } from './errors.js';
import { fnv1aHex } from './interactive.js';
import { stepFilePath } from './links.js';
import { stepsForGuide, type ProjectModel } from './load.js';
import type { StepCheck, StepCheckOption } from './schemas.js';

/** Where the i-th option check (0-based, among those with `n` options) of a guide puts its correct option. */
export function correctPosition(index: number, n: number, offset = 0): number {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`option count must be a positive integer, got ${n}`);
  return (((offset + index) % n) + n) % n;
}

/** The guide's fixed starting offset for checks with `n` options. */
export function guideOffset(guideId: string, n: number): number {
  return parseInt(fnv1aHex(`${guideId}#${n}`), 16) % n;
}

/**
 * `options` with the (first) correct one moved to `position`, the others in
 * their written order around it. Options without a correct one come back
 * unchanged (the schema already reports that).
 */
export function placeCorrectOption<T extends Pick<StepCheckOption, 'correct'>>(options: readonly T[], position: number): T[] {
  const at = options.findIndex((o) => o.correct === true);
  if (at < 0) return [...options];
  const wrong = options.filter((_, i) => i !== at);
  const p = Math.min(Math.max(0, position), wrong.length);
  return [...wrong.slice(0, p), options[at]!, ...wrong.slice(p)];
}

/**
 * Reorder, in place, the options of every multiple-choice check of every
 * guide, in reading order (`stepsForGuide`). A step in several guides is
 * placed by the first guide in the config that has it.
 */
export function placeCheckOptions(model: ProjectModel): void {
  const placed = new Set<StepCheck>();
  for (const guide of model.config.guides) {
    const seen = new Map<number, number>();
    for (const step of stepsForGuide(model, guide.id)) {
      for (const check of step.checks ?? []) {
        if (!check.options) continue;
        const n = check.options.length;
        const index = seen.get(n) ?? 0;
        seen.set(n, index + 1);
        if (placed.has(check)) continue;
        placed.add(check);
        check.options = placeCorrectOption(check.options, correctPosition(index, n, guideOffset(guide.id, n)));
      }
    }
  }
}

/** One warning per yes/no check: a question that begs "yes" from a reader in a hurry. */
export function yesNoCheckWarnings(model: ProjectModel): Problem[] {
  const out: Problem[] = [];
  for (const step of model.steps.values()) {
    step.checks?.forEach((check, i) => {
      if (check.options) return;
      out.push({ code: 'schema', file: stepFilePath(step.id), path: `checks.${i}`, message: `yes/no check "${check.id}": rewrite as options` });
    });
  }
  sortProblems(out);
  return out;
}

/** The repo-relative images of a check's options (https images are not the project's files). */
export function localCheckImages(check: Pick<StepCheck, 'options'>): string[] {
  return (check.options ?? []).flatMap((o) => (o.image !== undefined && !/^https:\/\//i.test(o.image) ? [o.image] : []));
}
