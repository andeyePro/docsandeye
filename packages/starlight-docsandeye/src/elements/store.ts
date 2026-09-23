/**
 * The reader's saved state: the profile, received counts and check answers,
 * one `localStorage` key each per guide. Every read and write is wrapped in
 * try/catch (storage may be disabled, full or blocked); absent or unreadable
 * state falls back to defaults. Profile and check changes are announced on
 * `document` so every element re-evaluates live.
 */
import { STORAGE_KEYS, parseStoredProfile, type Profile, type ProfileItem } from '@docsandeye/core/interactive';

export const PROFILE_EVENT = 'docsandeye:profile';
export const CHECKS_EVENT = 'docsandeye:checks';

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the page still works for this visit */
  }
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
