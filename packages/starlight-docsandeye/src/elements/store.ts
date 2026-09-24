/**
 * The reader's saved state: the profile, received counts, check answers and
 * check-offs, one `localStorage` key each per guide, behind one consent gate.
 * Every write lands in an in-memory copy first; it reaches `localStorage`
 * only once the reader has chosen "Save" (`docsandeye:consent=yes`, the one
 * key written for the gate itself). Until then the first write asks
 * (`CONSENT_EVENT`), and after "Don't save" nothing is written at all. Every
 * storage access is wrapped in try/catch (storage may be disabled, full or
 * blocked); absent or unreadable state falls back to defaults. Profile, check
 * and check-off changes are announced on `document` so every element
 * re-evaluates live.
 */
import { CONSENT_KEY, STORAGE_KEYS, parseConsent, parseStoredProfile, type ConsentState, type Profile, type ProfileItem } from '@docsandeye/core/interactive';

export const PROFILE_EVENT = 'docsandeye:profile';
export const CHECKS_EVENT = 'docsandeye:checks';
export const PARTS_EVENT = 'docsandeye:parts';
/** Fired on `document` when the consent state changes or a write needs a decision. */
export const CONSENT_EVENT = 'docsandeye:consent';

/**
 * This page's own writes, so the page keeps working for the visit when
 * `localStorage` throws (blocked site data, some private modes, quota):
 * without it every element would re-read the defaults and drop the reader's
 * answer the moment they gave it.
 */
const memory = new Map<string, string>();

export function readStorage(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

let consent: ConsentState | undefined;
let changed = false;

/** `yes` (saving), `no` (declined for this visit) or `unasked`. */
export function consentState(): ConsentState {
  if (consent === undefined) {
    try {
      consent = parseConsent(window.localStorage.getItem(CONSENT_KEY));
    } catch {
      consent = 'unasked';
    }
  }
  return consent;
}

/** True once this page has written anything (the consent bar waits for it). */
export function hasChanges(): boolean {
  return changed;
}

function persist(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the in-memory copy keeps the page working for this visit */
  }
}

function announceConsent(): void {
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { state: consentState() } }));
}

/**
 * The reader's decision. Save: record consent and write everything this
 * visit has changed so far. Don't save: remember it for this visit only;
 * nothing is written.
 */
export function setConsent(save: boolean): void {
  consent = save ? 'yes' : 'no';
  if (save) {
    persist(CONSENT_KEY, 'yes');
    for (const [key, value] of memory) persist(key, value);
  }
  announceConsent();
}

export function writeStorage(key: string, value: string): void {
  memory.set(key, value);
  const first = !changed;
  changed = true;
  const state = consentState();
  if (state === 'yes') persist(key, value);
  else if (state === 'unasked' && first) announceConsent();
}

/** A stored JSON object, or `{}`. */
export function readRecord(key: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readStorage(key) ?? '{}');
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Parse a JSON `data-*` attribute; `fallback` when absent or malformed. */
export function dataJson<T>(el: Element, name: string, fallback: T): T {
  const raw = el.getAttribute(`data-${name}`);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** The guide id of the current page (`<meta name="docsandeye:guide">`). */
export function pageGuide(doc: Document = document): string | undefined {
  return doc.querySelector('meta[name="docsandeye:guide"]')?.getAttribute('content') ?? undefined;
}

/** The profile questions the server put in `<script type="application/json" data-docsi-profile>`. */
export function profileItems(doc: Document = document): ProfileItem[] {
  const text = doc.querySelector('script[data-docsi-profile]')?.textContent;
  if (!text) return [];
  try {
    const items: unknown = JSON.parse(text);
    return Array.isArray(items) ? (items as ProfileItem[]) : [];
  } catch {
    return [];
  }
}

/** The saved answers with implications applied (see core's `normaliseProfile`). */
export function loadProfile(guideId: string, items: readonly ProfileItem[]): Profile {
  return parseStoredProfile(items, readStorage(STORAGE_KEYS.profile(guideId)));
}

/** Save and announce; `source` lets the element that made the change ignore its own event. */
export function saveProfile(guideId: string, profile: Profile, source?: unknown): void {
  writeStorage(STORAGE_KEYS.profile(guideId), JSON.stringify(profile));
  document.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: { guideId, profile, source } }));
}

/** The page URL a support email points at (no fragment). */
export function pageUrl(): string {
  return window.location.href.replace(/#.*$/, '');
}
