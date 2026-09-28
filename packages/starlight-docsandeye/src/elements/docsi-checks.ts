/**
 * `<docsi-checks>`: checks at the end of a step. Upgraded, this element
 *
 * - multiple choice: enables the option buttons and hides the no-JavaScript
 *   "Show the answer"; a pick is compared with the check's opaque key
 *   (`optionAnswer`). Right: the check turns green with a tick and counts as
 *   checked (stored as `yes`). Wrong: that option is marked, its `fix` and
 *   the "Something else — contact us" email are shown, the right option is
 *   not revealed, and the reader can pick again (stored as `no:<token>`);
 * - yes/no: shows the Yes/No radios, reveals a question's issues and the
 *   contact email only when the reader answers No;
 *
 * saves the answers, restores them on load, and shows "Step checked" once
 * every visible check is right (which also ticks the step in the guide list
 * and sidebar).
 */
import {
  STORAGE_KEYS,
  answerKey,
  checkMailto,
  checksComplete,
  optionAnswer,
  profileSummary,
  wrongPick,
  type CheckRef,
  type Contact,
} from '@docsandeye/core/interactive';
import { CHECKS_EVENT, PROFILE_EVENT, dataJson, loadProfile, pageGuide, pageUrl, profileItems, readRecord, writeStorage } from './store.ts';

const ElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

const RIGHT_TEXT = 'Correct';
const WRONG_TEXT = 'Not that one. Look again and pick another.';

export class DocsiChecks extends ElementBase {
  private guideId = '';
  private stepId = '';

  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');
    this.guideId = this.dataset.guide ?? pageGuide() ?? '';
    this.stepId = this.dataset.step ?? '';
    if (!this.guideId || !this.stepId) return;
    for (const answer of this.querySelectorAll<HTMLElement>('.docsi-check-answer')) answer.hidden = false;
    for (const option of this.querySelectorAll<HTMLButtonElement>('.docsi-check-option')) option.disabled = false;
    for (const reveal of this.querySelectorAll<HTMLElement>('.docsi-check-reveal')) reveal.hidden = true;
    this.addEventListener('change', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
      const li = input.closest<HTMLElement>('[data-check]');
      if (li?.dataset.check) this.save(li.dataset.check, input.value);
    });
    this.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>('button.docsi-check-option');
      if (!button || button.disabled || !this.contains(button)) return;
      const li = button.closest<HTMLElement>('[data-check]');
      const id = li?.dataset.check;
      const token = button.dataset.option;
      if (!li || !id || !token) return;
      this.save(id, optionAnswer(this.stepId, id, li.dataset.key ?? '', token));
    });
    this.render();
    document.addEventListener(PROFILE_EVENT, () => this.render());
  }

  private save(checkId: string, value: string): void {
    const all = readRecord(STORAGE_KEYS.checks(this.guideId));
    all[this.stepId] = { ...((all[this.stepId] as Record<string, unknown> | undefined) ?? {}), [checkId]: value };
    writeStorage(STORAGE_KEYS.checks(this.guideId), JSON.stringify(all));
    this.render();
    document.dispatchEvent(new CustomEvent(CHECKS_EVENT, { detail: { guideId: this.guideId, stepId: this.stepId } }));
  }

  private answers(): Record<string, unknown> {
    return (readRecord(STORAGE_KEYS.checks(this.guideId))[this.stepId] as Record<string, unknown> | undefined) ?? {};
  }

  private render(): void {
    const answers = this.answers();
    const items = profileItems();
    const profile = loadProfile(this.guideId, items);
    const contact = dataJson<Contact | undefined>(this, 'contact', undefined);
    const refs: CheckRef[] = [];
    for (const li of this.querySelectorAll<HTMLElement>('[data-check]')) {
      const id = li.dataset.check!;
      refs.push({ id, when: dataJson(li, 'when', undefined) });
      const answer = answers[id];
      const choice = li.classList.contains('docsi-check-choice');
      // The option the reader picked: the right one (found by the key) or the stored wrong one.
      let picked: HTMLButtonElement | undefined;
      if (choice) {
        const options = [...li.querySelectorAll<HTMLButtonElement>('button.docsi-check-option')];
        const token = answer === 'yes' ? options.find((o) => answerKey(this.stepId, id, o.dataset.option ?? '') === li.dataset.key)?.dataset.option : wrongPick(answer);
        picked = options.find((o) => o.dataset.option === token);
        const right = answer === 'yes' && picked !== undefined;
        for (const option of options) {
          const on = option === picked;
          option.setAttribute('aria-pressed', String(on));
          option.toggleAttribute('data-docsi-right', on && right);
          option.toggleAttribute('data-docsi-wrong', on && !right);
          const mark = option.querySelector<HTMLElement>('.docsi-check-mark');
          if (mark) mark.textContent = on ? (right ? '✓' : '✗') : '';
        }
        li.toggleAttribute('data-docsi-right', right);
        const feedback = li.querySelector<HTMLElement>('.docsi-check-feedback');
        if (feedback) feedback.textContent = picked ? (right ? RIGHT_TEXT : WRONG_TEXT) : '';
        for (const fix of li.querySelectorAll<HTMLElement>('.docsi-check-fix')) fix.hidden = right || picked === undefined || fix.dataset.for !== picked.dataset.option;
      } else {
        for (const radio of li.querySelectorAll<HTMLInputElement>('input[type="radio"]')) radio.checked = radio.value === answer;
      }
      const wrong = choice ? picked !== undefined && answer !== 'yes' : answer === 'no';
      const issues = li.querySelector<HTMLDetailsElement>('.docsi-check-issues');
      if (issues) {
        issues.hidden = !wrong;
        issues.open = wrong;
      }
      const help = li.querySelector<HTMLElement>('.docsi-check-contact');
      const link = help?.querySelector<HTMLAnchorElement>('a');
      if (help && link) {
        const href = wrong
          ? checkMailto({
              contact,
              stepTitle: this.dataset.stepTitle ?? '',
              question: li.dataset.question ?? li.querySelector('.docsi-check-q')?.textContent?.trim() ?? '',
              profileSummary: profileSummary(items, profile),
              pageUrl: pageUrl(),
              ...(choice && picked ? { answer: picked.querySelector('.docsi-check-label')?.textContent?.trim() ?? '' } : {}),
            })
          : undefined;
        help.hidden = href === undefined;
        if (href) link.href = href;
      }
    }
    const done = this.querySelector<HTMLElement>('.docsi-checks-done');
    if (done) done.hidden = !checksComplete(refs, answers, profile);
  }
}
