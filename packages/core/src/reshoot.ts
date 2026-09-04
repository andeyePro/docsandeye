/**
 * Inverse of the staleness report: for each component, where does it appear
 * and how many of those appearances are stale hero shots?
 */
import type { ProjectModel } from './load.js';
import { parsePin, type MediaType } from './schemas.js';
import type { StalenessReport, StalenessStatus } from './staleness.js';

export type AppearanceRole = 'hero' | 'in_frame';

export interface Appearance {
  media: string;
  type: MediaType;
  role: AppearanceRole;
  shot_with: string;
  /** The media manifest's overall staleness status. */
  status: StalenessStatus;
}

export interface ReshootEntry {
  component: string;
  name: string;
  current: string;
  /** Hero appearances whose pinned version differs from the current design_version. */
  staleHeroCount: number;
  appearances: Appearance[];
}

/**
 * Sorted by `staleHeroCount` descending, then `component` ascending; components with
 * no appearances are omitted; appearances sorted by `media` (then role).
 */
export function buildReshootIndex(model: ProjectModel, staleness: StalenessReport): ReshootEntry[] {
  const byComponent = new Map<string, ReshootEntry>();

  const mediaIds = [...model.media.keys()].sort();
  for (const mediaId of mediaIds) {
    const media = model.media.get(mediaId)!;
    const status = staleness[mediaId]?.status ?? 'FRESH';
    const staleHeroes = new Set((staleness[mediaId]?.stale_heroes ?? []).map((h) => h.component));
    const visit = (pins: readonly string[], role: AppearanceRole) => {
      for (const raw of pins) {
        const pin = parsePin(raw);
        if (!pin) continue;
        const component = model.components.get(pin.id);
        if (!component) continue;
        let entry = byComponent.get(pin.id);
        if (!entry) {
          entry = { component: pin.id, name: component.name, current: component.design_version, staleHeroCount: 0, appearances: [] };
          byComponent.set(pin.id, entry);
        }
        entry.appearances.push({ media: mediaId, type: media.type, role, shot_with: pin.version, status });
        if (role === 'hero' && staleHeroes.has(pin.id)) entry.staleHeroCount += 1;
      }
    };
    visit(media.hero, 'hero');
    visit(media.in_frame, 'in_frame');
  }

  const entries = [...byComponent.values()];
  for (const e of entries) {
    e.appearances.sort((a, b) => (a.media !== b.media ? (a.media < b.media ? -1 : 1) : a.role < b.role ? -1 : a.role > b.role ? 1 : 0));
  }
  entries.sort((a, b) => (b.staleHeroCount !== a.staleHeroCount ? b.staleHeroCount - a.staleHeroCount : a.component < b.component ? -1 : a.component > b.component ? 1 : 0));
  return entries;
}
