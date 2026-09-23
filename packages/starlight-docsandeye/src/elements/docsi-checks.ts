/**
 * `<docsi-checks>`: yes/no checks at the end of a step. The server renders
 * each question with its likely issues in a `<details>`; upgraded, this
 * element shows Yes/No radio buttons, reveals a question's issues and a
 * "Something else — contact us" email only when the reader answers No,
 * saves the answers and shows "Step checked" once every visible check is Yes
 * (which also ticks the step in the guide list and sidebar).
 */
import {
  STORAGE_KEYS,
  checkMailto,
  checksComplete,
  profileSummary,
  type CheckRef,
  type Contact,
} from '@docsandeye/core/interactive';
import { CHECKS_EVENT, PROFILE_EVENT, dataJson, loadProfile, pageGuide, pageUrl, profileItems, readRecord, writeStorage } from './store.ts';

const ElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

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
    this.addEventListener('change', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
      const li = input.closest<HTMLElement>('[data-check]');
      if (!li?.dataset.check) return;
      const all = readRecord(STORAGE_KEYS.checks(this.guideId));
      const step = { ...((all[this.stepId] as Record<string, unknown> | undefined) ?? {}), [li.dataset.check]: input.value };
      all[this.stepId] = step;
      writeStorage(STORAGE_KEYS.checks(this.guideId), JSON.stringify(all));
      this.render();
      document.dispatchEvent(new CustomEvent(CHECKS_EVENT, { detail: { guideId: this.guideId, stepId: this.stepId } }));
    });
    this.render();
    document.addEventListener(PROFILE_EVENT, () => this.render());
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
      for (const radio of li.querySelectorAll<HTMLInputElement>('input[type="radio"]')) radio.checked = radio.value === answer;
      const no = answer === 'no';
      const issues = li.querySelector<HTMLDetailsElement>('.docsi-check-issues');
      if (issues) {
        issues.hidden = !no;
        issues.open = no;
      }
      const help = li.querySelector<HTMLElement>('.docsi-check-contact');
      const link = help?.querySelector<HTMLAnchorElement>('a');
      if (help && link) {
        const href = no
          ? checkMailto({
              contact,
              stepTitle: this.dataset.stepTitle ?? '',
              question: li.querySelector('.docsi-check-q')?.textContent?.trim() ?? '',
              profileSummary: profileSummary(items, profile),
              pageUrl: pageUrl(),
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
