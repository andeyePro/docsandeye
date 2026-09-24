/**
 * The saving-consent UI: the bottom bar ("Save your answers in this
 * browser?") and the not-saved notice under the profile summary. Both are
 * server-rendered hidden (`.docsi-consent-bar`, `.docsi-consent-notice`);
 * core's `consentView` decides what shows. Buttons carry
 * `data-consent-action`: `save` / `allow` (consent), `decline` (don't save),
 * `hide` (hide the notice for this tab: a sessionStorage flag when
 * sessionStorage works, else for this page only).
 */
import { CONSENT_NOTICE_HIDDEN_KEY, consentView } from '@docsandeye/core/interactive';
import { CONSENT_EVENT, consentState, hasChanges, setConsent } from './store.ts';

let noticeHidden = false;

function readNoticeHidden(): boolean {
  if (noticeHidden) return true;
  try {
    return window.sessionStorage.getItem(CONSENT_NOTICE_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function hideNotice(): void {
  noticeHidden = true;
  try {
    window.sessionStorage.setItem(CONSENT_NOTICE_HIDDEN_KEY, '1');
  } catch {
    /* in memory only */
  }
}

export function renderConsent(doc: Document = document): void {
  const view = consentView(consentState(), hasChanges(), readNoticeHidden());
  for (const bar of doc.querySelectorAll<HTMLElement>('.docsi-consent-bar')) bar.hidden = !view.bar;
  for (const notice of doc.querySelectorAll<HTMLElement>('.docsi-consent-notice')) notice.hidden = !view.notice;
}

export function initConsent(doc: Document = document): void {
  doc.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest?.<HTMLElement>('[data-consent-action]');
    const action = button?.dataset.consentAction;
    if (!action) return;
    if (action === 'save' || action === 'allow') setConsent(true);
    else if (action === 'decline') setConsent(false);
    else if (action === 'hide') {
      hideNotice();
      renderConsent(doc);
    }
  });
  doc.addEventListener(CONSENT_EVENT, () => renderConsent(doc));
  renderConsent(doc);
}
