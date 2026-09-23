/**
 * The one client module that evaluates `data-when` against the reader's
 * profile. The server shows everything, each conditional block labelled;
 * this only hides what does not apply:
 *
 * - default: a non-matching element gets `hidden`;
 * - `data-when-mode="skip"` (guide list and sidebar entries): marked
 *   `data-docsi-skipped` and its `.docsi-skip-note` shown, never removed;
 * - `data-when-mode="unless"` (a step's "doesn't apply" notice): shown only
 *   when the condition fails, with its link pointed at the next step that
 *   does apply (`data-next`).
 *
 * It also ticks guide list and sidebar entries (`data-checks`) whose checks
 * are all answered yes.
 */
import {
  STORAGE_KEYS,
  checksComplete,
  matchesWhen,
  nextApplicableStep,
  type CheckRef,
  type Profile,
  type StepRef,
  type When,
} from '@docsandeye/core/interactive';
import { CHECKS_EVENT, PROFILE_EVENT, dataJson, loadProfile, pageGuide, profileItems, readRecord } from './store.ts';

export function applyConditions(root: ParentNode, profile: Profile, guideId: string): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-when]')) {
    const ok = matchesWhen(dataJson<When>(el, 'when', {}), profile);
    const mode = el.dataset.whenMode;
    if (mode === 'skip') {
      el.toggleAttribute('data-docsi-skipped', !ok);
      const note = el.querySelector<HTMLElement>('.docsi-skip-note');
      if (note) note.hidden = ok;
    } else if (mode === 'unless') {
      el.hidden = ok;
      if (!ok) pointSkipLink(el, profile);
    } else {
      el.hidden = !ok;
    }
  }
  const answers = readRecord(STORAGE_KEYS.checks(guideId));
  for (const el of root.querySelectorAll<HTMLElement>('[data-checks]')) {
    const stepAnswers = answers[el.dataset.step ?? ''] as Record<string, unknown> | undefined;
    const done = checksComplete(dataJson<CheckRef[]>(el, 'checks', []), stepAnswers, profile);
    el.toggleAttribute('data-docsi-checked', done);
    const mark = el.querySelector<HTMLElement>('.docsi-checked-mark');
    if (mark) mark.hidden = !done;
  }
}

function pointSkipLink(el: HTMLElement, profile: Profile): void {
  const link = el.querySelector<HTMLAnchorElement>('a.docsi-skip-link');
  if (!link) return;
  const next = nextApplicableStep(dataJson<StepRef[]>(el, 'next', []), profile);
  link.href = next?.href ?? el.dataset.guideHref ?? link.href;
  link.textContent = next ? `Skip to ${next.title}` : 'Back to the guide overview';
}

/** Evaluate once now and again whenever the profile or a check answer changes. */
export function initConditions(doc: Document = document): void {
  const guideId = pageGuide(doc);
  if (!guideId) return;
  const items = profileItems(doc);
  const run = (): void => applyConditions(doc, loadProfile(guideId, items), guideId);
  run();
  doc.addEventListener(PROFILE_EVENT, run);
  doc.addEventListener(CHECKS_EVENT, run);
}
