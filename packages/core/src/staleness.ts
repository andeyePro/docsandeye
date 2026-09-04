/**
 * Build-time staleness engine: pins each media manifest's `component@version`
 * against the component's current `design_version`.
 */
import semver from 'semver';
import type { ProjectModel } from './load.js';
import { parsePin, type ChangelogEntry, type MediaType } from './schemas.js';

export type StalenessStatus = 'FRESH' | 'CHANGED_IN_FRAME' | 'STALE';

export interface StalePin {
  component: string;
  shot_with: string;
  current: string;
  /** The component's changelog entries with `shot_with < version <= current`, ascending. */
  changelog: ChangelogEntry[];
}

export interface StalenessEntry {
  type: MediaType;
  status: StalenessStatus;
  shot_date: string;
  stale_heroes: StalePin[];
  changed_in_frame: StalePin[];
}

export type StalenessReport = Record<string, StalenessEntry>;

/**
 * STALE iff any hero pin differs from the current `design_version`;
 * CHANGED_IN_FRAME iff no hero differs but an in_frame pin does; FRESH otherwise.
 * Pure: never mutates `model`. Keys are media ids in lexicographic order.
 */
export function computeStaleness(model: ProjectModel): StalenessReport {
  const report: StalenessReport = {};
  const ids = [...model.media.keys()].sort();
  for (const id of ids) {
    const media = model.media.get(id)!;
    const stale_heroes = changedPins(model, media.hero);
    const changed_in_frame = changedPins(model, media.in_frame);
    const status: StalenessStatus = stale_heroes.length > 0 ? 'STALE' : changed_in_frame.length > 0 ? 'CHANGED_IN_FRAME' : 'FRESH';
    report[id] = { type: media.type, status, shot_date: media.shot_date, stale_heroes, changed_in_frame };
  }
  return report;
}

function changedPins(model: ProjectModel, pins: readonly string[]): StalePin[] {
  const out: StalePin[] = [];
  for (const raw of pins) {
    const pin = parsePin(raw);
    if (!pin) continue;
    const component = model.components.get(pin.id);
    if (!component) continue; // reported by loadProject as unknown-component
    const current = component.design_version;
    if (semver.compare(pin.version, current) === 0) continue;
    out.push({
      component: pin.id,
      shot_with: pin.version,
      current,
      changelog: changelogBetween(component.changelog ?? [], pin.version, current),
    });
  }
  return out;
}

/** Entries with `from < version <= to`, ascending by version; copies, never shared references. */
export function changelogBetween(changelog: readonly ChangelogEntry[], from: string, to: string): ChangelogEntry[] {
  return changelog
    .filter((e) => semver.compare(e.version, from) === 1 && semver.compare(e.version, to) !== 1)
    .sort((a, b) => semver.compare(a.version, b.version))
    .map((e) => ({ ...e }));
}
