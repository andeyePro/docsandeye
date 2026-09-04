import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadProject, computeStaleness, canonicalJson } from '../src/index.js';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '../fixtures');

describe('AC7: Staleness', () => {
  it('returns Record<mediaId, StalenessEntry>', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const staleness = computeStaleness(model);
    expect(typeof staleness).toBe('object');
    expect(staleness).not.toBeInstanceOf(Array);
  });

  it('computes FRESH status when hero pins match current version', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const staleness = computeStaleness(model);
    // minimal fixture has fresh media
    const freshEntries = Object.values(staleness).filter(e => e.status === 'FRESH');
    expect(freshEntries.length).toBeGreaterThan(0);
  });

  it('aep-like fixture yields exactly one STALE and one CHANGED_IN_FRAME', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const staleCount = Object.values(staleness).filter(e => e.status === 'STALE').length;
    const changedCount = Object.values(staleness).filter(e => e.status === 'CHANGED_IN_FRAME').length;
    expect(staleCount).toBe(1);
    expect(changedCount).toBe(1);
  });

  it('canonicalJson output has sorted keys at all levels', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const json = canonicalJson(staleness);
    const parsed = JSON.parse(json);
    // Check top level keys are sorted
    const topKeys = Object.keys(parsed);
    const sortedTopKeys = [...topKeys].sort();
    expect(topKeys).toEqual(sortedTopKeys);
    // Check nested object keys are sorted
    for (const entry of Object.values(parsed) as any[]) {
      const entryKeys = Object.keys(entry);
      const sortedEntryKeys = [...entryKeys].sort();
      expect(entryKeys).toEqual(sortedEntryKeys);
    }
  });

  it('never mutates input model', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const modelBefore = JSON.stringify({
      components: [...model.components.entries()],
      steps: [...model.steps.entries()],
      media: [...model.media.entries()],
    });
    computeStaleness(model);
    const modelAfter = JSON.stringify({
      components: [...model.components.entries()],
      steps: [...model.steps.entries()],
      media: [...model.media.entries()],
    });
    expect(modelAfter).toEqual(modelBefore);
  });

  it('stale entry includes component, shot_with, current, changelog', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const staleEntries = Object.entries(staleness).filter(([_, e]) => e.status === 'STALE');
    expect(staleEntries.length).toBeGreaterThan(0);
    for (const [_, entry] of staleEntries) {
      if (entry.stale_heroes) {
        for (const hero of entry.stale_heroes) {
          expect(hero).toHaveProperty('component');
          expect(hero).toHaveProperty('shot_with');
          expect(hero).toHaveProperty('current');
          expect(hero).toHaveProperty('changelog');
          expect(Array.isArray(hero.changelog)).toBe(true);
        }
      }
    }
  });

  it('changelog entries between shot_with and current are ascending', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    for (const entry of Object.values(staleness)) {
      if (entry.stale_heroes) {
        for (const hero of entry.stale_heroes) {
          const versions = hero.changelog.map((e: any) => e.version);
          for (let i = 1; i < versions.length; i++) {
            // Compare as semver - should be ascending
            const prev = versions[i - 1].split('.').map(Number);
            const curr = versions[i].split('.').map(Number);
            let isAscending = false;
            for (let j = 0; j < 3; j++) {
              if (curr[j] > prev[j]) {
                isAscending = true;
                break;
              } else if (curr[j] < prev[j]) {
                break;
              }
            }
            expect(isAscending || prev === curr).toBe(true);
          }
        }
      }
    }
  });

  it('changed_in_frame entry includes component, shot_with, current', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const changedEntries = Object.entries(staleness).filter(([_, e]) => e.status === 'CHANGED_IN_FRAME');
    expect(changedEntries.length).toBeGreaterThan(0);
    for (const [_, entry] of changedEntries) {
      if (entry.changed_in_frame) {
        for (const frame of entry.changed_in_frame) {
          expect(frame).toHaveProperty('component');
          expect(frame).toHaveProperty('shot_with');
          expect(frame).toHaveProperty('current');
        }
      }
    }
  });

  it('round-trips through JSON.parse to deep-equal value', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const json = canonicalJson(staleness, { compact: false });
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(staleness);
  });
});
