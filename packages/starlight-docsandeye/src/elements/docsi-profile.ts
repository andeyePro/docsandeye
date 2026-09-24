/**
 * `<docsi-profile>`: the reader's setup form (number input, checkboxes,
 * radio groups, link options), server-rendered with the defaults. Upgraded,
 * it shows the saved answers, hides the questions the chosen options imply
 * (`data-profile-field`), and saves every change, which re-evaluates the
 * page live.
 *
 * `<docsi-profile-summary>`: the one-line "Your setup: … — change" bar on
 * step pages, hidden until upgraded (without JavaScript nothing is tailored,
 * so there is no setup to summarise).
 */
import { impliedItems, normaliseProfile, profileSummary, type Profile, type ProfileItem } from '@docsandeye/core/interactive';
import { PROFILE_EVENT, loadProfile, pageGuide, profileItems, saveProfile } from './store.ts';

const ElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

function fillForm(form: HTMLFormElement, items: readonly ProfileItem[], profile: Profile): void {
  const implied = impliedItems(items, profile);
  for (const field of form.querySelectorAll<HTMLElement>('[data-profile-field]')) field.hidden = field.dataset.profileField! in implied;
  for (const item of items) {
    const value = profile[item.id];
    if (item.type === 'choice') {
      for (const radio of form.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${item.id}"]`)) radio.checked = radio.value === value;
      continue;
    }
    const input = form.querySelector<HTMLInputElement>(`input[name="${item.id}"]`);
    if (!input) continue;
    if (item.type === 'boolean') input.checked = value === true;
    else input.value = String(value);
  }
}

function readForm(form: HTMLFormElement, items: readonly ProfileItem[]): Profile {
  const raw: Record<string, unknown> = {};
  for (const item of items) {
    if (item.type === 'choice') {
      raw[item.id] = form.querySelector<HTMLInputElement>(`input[type="radio"][name="${item.id}"]:checked`)?.value;
      continue;
    }
    const input = form.querySelector<HTMLInputElement>(`input[name="${item.id}"]`);
    if (input) raw[item.id] = item.type === 'boolean' ? input.checked : input.value;
  }
  return normaliseProfile(items, raw);
}

export class DocsiProfile extends ElementBase {
  private guideId = '';
  private items: ProfileItem[] = [];

  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');
    this.guideId = this.dataset.guide ?? pageGuide() ?? '';
    this.items = profileItems();
    const form = this.querySelector('form');
    if (!form || !this.guideId) return;
    fillForm(form, this.items, loadProfile(this.guideId, this.items));
    const saved = this.querySelector<HTMLElement>('.docsi-profile-saved');
    const onChange = (): void => {
      const profile = readForm(form, this.items);
      // Show the normalised answers (a number clamped to its range, an empty field back to its default).
      fillForm(form, this.items, profile);
      saveProfile(this.guideId, profile, this);
      if (saved) saved.hidden = false;
    };
    form.addEventListener('change', onChange);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      onChange();
    });
    document.addEventListener(PROFILE_EVENT, (event) => {
      const detail = (event as CustomEvent<{ source?: unknown; profile: Profile }>).detail;
      if (detail?.source !== this) fillForm(form, this.items, detail.profile);
    });
  }
}

export class DocsiProfileSummary extends ElementBase {
  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');
    const guideId = this.dataset.guide ?? pageGuide() ?? '';
    const items = profileItems();
    const bar = this.querySelector<HTMLElement>('.docsi-profile-summary');
    const text = this.querySelector<HTMLElement>('.docsi-profile-summary-text');
    if (!bar || !text || !guideId || items.length === 0) return;
    const render = (): void => {
      text.textContent = profileSummary(items, loadProfile(guideId, items));
    };
    render();
    bar.hidden = false;
    document.addEventListener(PROFILE_EVENT, render);
  }
}
