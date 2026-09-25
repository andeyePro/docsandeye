/**
 * The "count what you received" checklist of a guide, built from the
 * components that carry `receipt` data. `receiptItems` is the static,
 * serialisable part the plugin hands to the page; `buildReceipt` applies a
 * profile to it with the same pure function the browser runs.
 */
import { stepsForGuide, type ProjectModel } from './load.js';
import { computeReceipt, type Profile, type Receipt, type ReceiptItem } from './interactive.js';

/** True for a note that is still a maintainer's draft: it starts with `DRAFT:` (any case). */
export function isDraftNote(note: string): boolean {
  return /^\s*draft:/i.test(note);
}

export interface ReceiptItemsOptions {
  /** A maintainer build keeps `DRAFT:` notes; a reader build (the default) drops them. */
  maintainer?: boolean;
}

/**
 * Components with `receipt` data that belong to `guideId`: those referenced
 * (as a part or tool) by a step of the guide, plus those no step references
 * at all — a receipt-only item such as a spares bag belongs to every guide.
 * Ordered by component name, then id. A `DRAFT:` note is left out unless
 * `options.maintainer`.
 */
export function receiptItems(model: ProjectModel, guideId: string, options: ReceiptItemsOptions = {}): ReceiptItem[] {
  const inGuide = new Set<string>();
  for (const step of stepsForGuide(model, guideId)) {
    for (const ref of [...step.parts, ...step.tools]) inGuide.add(ref.component);
  }
  const referencedAnywhere = new Set<string>();
  for (const step of model.steps.values()) {
    for (const ref of [...step.parts, ...step.tools]) referencedAnywhere.add(ref.component);
  }

  const items: ReceiptItem[] = [];
  for (const component of model.components.values()) {
    const receipt = component.receipt;
    if (!receipt) continue;
    if (!inGuide.has(component.id) && referencedAnywhere.has(component.id)) continue;
    const item: ReceiptItem = { component: component.id, name: component.name, per: receipt.per, qty: receipt.qty };
    if (receipt.from !== undefined) item.from = [...receipt.from];
    if (receipt.when !== undefined) item.when = receipt.when;
    if (receipt.note !== undefined && (options.maintainer === true || !isDraftNote(receipt.note))) item.note = receipt.note;
    if (component.supplier) {
      item.supplier = { name: component.supplier.name };
      if (component.supplier.url !== undefined) item.supplier.url = component.supplier.url;
    }
    items.push(item);
  }
  return items.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.component < b.component ? -1 : a.component > b.component ? 1 : 0));
}

/** The checklist of `guideId` for `profile`: per-unit, per-kit and "source these yourself" groups. Pure. */
export function buildReceipt(model: ProjectModel, guideId: string, profile: Profile): Receipt {
  return computeReceipt(receiptItems(model, guideId), profile, model.config.receipt ?? {});
}
