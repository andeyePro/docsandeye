/**
 * Pure build-time helpers for the reader-interactive markup: the JSON the
 * server puts in `data-*` attributes for the client elements, and the text
 * shown without JavaScript. The decisions themselves (conditions, receipt
 * maths, mailtos) live in `@docsandeye/core/interactive`, shared with the
 * browser.
 */
import { receiptItems, type Guide, type ProjectModel, type Step } from '@docsandeye/core';
import { describeWhen, type CheckRef, type Contact, type ProfileItem, type ReceiptItem, type StepRef, type When } from '@docsandeye/core/interactive';
import { stepHref } from './view.ts';

/** JSON for a `data-when` attribute (Astro escapes it); undefined when there is no condition. */
export function whenAttr(when: When | undefined): string | undefined {
  return when && Object.keys(when).length > 0 ? JSON.stringify(when) : undefined;
}

/** `Only if: …` for a condition, or undefined. */
export function onlyIf(when: When | undefined, items: readonly ProfileItem[]): string | undefined {
  return when && Object.keys(when).length > 0 ? `Only if: ${describeWhen(when, items)}` : undefined;
}

/** JSON for an inline `<script type="application/json">`: `<` escaped so the text can never close the element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** The steps after `stepId` in guide order, as skip targets for the "doesn't apply" notice. */
export function skipTargets(steps: readonly Step[], stepId: string, guide: Pick<Guide, 'base'>, siteBase = '/'): StepRef[] {
  const index = steps.findIndex((s) => s.id === stepId);
  return steps.slice(index + 1).map((s) => {
    const ref: StepRef = { title: s.title, href: stepHref(guide, s.id, siteBase) };
    if (s.when) ref.when = s.when;
    return ref;
  });
}

/** `[{id, when}]` for a step's checks (for the guide list and sidebar ticks); undefined without checks. */
export function checkRefs(step: Step): CheckRef[] | undefined {
  if (!step.checks || step.checks.length === 0) return undefined;
  return step.checks.map((c) => (c.when ? { id: c.id, when: c.when } : { id: c.id }));
}

/** The receipt items of a guide (see core's `receiptItems`). */
export function guideReceiptItems(model: ProjectModel, guideId: string): ReceiptItem[] {
  return receiptItems(model, guideId);
}

/** Option label of a choice value of `supplier_from` (for "from <label>" wording); the value itself when unknown. */
export function supplierLabels(model: ProjectModel): Record<string, string> {
  const id = model.config.receipt?.supplier_from;
  const item = model.config.profile.find((p) => p.id === id);
  const out: Record<string, string> = {};
  for (const o of item?.options ?? []) out[o.value] = o.label;
  return out;
}

/** A plain `mailto:` for the no-JavaScript fallbacks (subject only). */
export function plainMailto(contact: Contact | undefined, subjectSuffix?: string): string | undefined {
  if (!contact?.email) return undefined;
  const subject = subjectSuffix ? `${contact.subject ?? 'Help with a step'}: ${subjectSuffix}` : contact.subject;
  return subject ? `mailto:${contact.email}?subject=${encodeURIComponent(subject)}` : `mailto:${contact.email}`;
}

/** `per unit` / `per kit` rows of the no-JavaScript receipt table, each ordered by name (as the client does). */
export function staticReceiptGroups(items: readonly ReceiptItem[]): { perUnit: ReceiptItem[]; perKit: ReceiptItem[] } {
  return { perUnit: items.filter((i) => i.per === 'unit'), perKit: items.filter((i) => i.per === 'kit') };
}
