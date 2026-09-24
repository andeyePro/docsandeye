/**
 * Check-offs: the "have it" / "done" boxes at the start of parts, tools and
 * receipt rows (`input.docsi-checkoff[data-checkoff="<step>/<component>"]`).
 * The server renders them hidden, so without JavaScript the lists read as
 * plain lists; upgraded, they show, remember their state with the other
 * guide state (`docsandeye:parts:<guide>`) and mark their row
 * `data-docsi-done` (muted, ticked; never hidden). One document-level
 * listener serves every box, including those the receipt builds later.
 */
import { STORAGE_KEYS, checkedKeys, setCheckoff } from '@docsandeye/core/interactive';
import { PARTS_EVENT, pageGuide, readRecord, writeStorage } from './store.ts';

/** The checked keys of this guide. */
export function doneKeys(guideId: string): Set<string> {
  return checkedKeys(readRecord(STORAGE_KEYS.parts(guideId)));
}

/** Show every box under `root` with its saved state and mark its row. */
export function applyCheckoffs(root: ParentNode, guideId: string): void {
  const done = doneKeys(guideId);
  for (const input of root.querySelectorAll<HTMLInputElement>('input.docsi-checkoff[data-checkoff]')) {
    input.hidden = false;
    input.checked = done.has(input.dataset.checkoff!);
    input.closest('li, tr')?.toggleAttribute('data-docsi-done', input.checked);
  }
}

export function initCheckoffs(doc: Document = document): void {
  const guideId = pageGuide(doc);
  if (!guideId) return;
  applyCheckoffs(doc, guideId);
  doc.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('docsi-checkoff') || !input.dataset.checkoff) return;
    const key = STORAGE_KEYS.parts(guideId);
    writeStorage(key, JSON.stringify(setCheckoff(readRecord(key), input.dataset.checkoff, input.checked)));
    doc.dispatchEvent(new CustomEvent(PARTS_EVENT, { detail: { guideId } }));
  });
  doc.addEventListener(PARTS_EVENT, () => applyCheckoffs(doc, guideId));
}
