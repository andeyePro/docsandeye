import { describe, it, expect } from 'vitest';
import { loadProject, computeStaleness, buildReshootIndex } from '../src/index.js';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '../fixtures');

describe('AC8: Reshoot index', () => {
  it('returns Array with component, name, current, staleHeroCount, appearances', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const staleness = computeStaleness(model);
    const index = buildReshootIndex(model, staleness);
    expect(Array.isArray(index)).toBe(true);
    for (const entry of index) {
      expect(entry).toHaveProperty('component');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('current');
      expect(entry).toHaveProperty('staleHeroCount');
      expect(entry).toHaveProperty('appearances');
      expect(Array.isArray(entry.appearances)).toBe(true);
    }
  });

  it('sorts by staleHeroCount descending then component ascending', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const index = buildReshootIndex(model, staleness);
    for (let i = 1; i < index.length; i++) {
      const prev = index[i - 1];
      const curr = index[i];
      if (prev.staleHeroCount === curr.staleHeroCount) {
        expect(curr.component >= prev.component).toBe(true);
      } else {
        expect(curr.staleHeroCount <= prev.staleHeroCount).toBe(true);
      }
    }
  });

  it('omits components with no appearances', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const index = buildReshootIndex(model, staleness);
    // All components in index should have at least one appearance
    for (const entry of index) {
      expect(entry.appearances.length).toBeGreaterThan(0);
    }
  });

  it('appearance entries include media, type, role, shot_with, status', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const index = buildReshootIndex(model, staleness);
    for (const entry of index) {
      for (const appearance of entry.appearances) {
        expect(appearance).toHaveProperty('media');
        expect(appearance).toHaveProperty('type');
        expect(['hero', 'in_frame']).toContain(appearance.role);
        expect(appearance).toHaveProperty('shot_with');
        expect(appearance).toHaveProperty('status');
      }
    }
  });

  it('appearances sorted by media id', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const staleness = computeStaleness(model);
    const index = buildReshootIndex(model, staleness);
    for (const entry of index) {
      for (let i = 1; i < entry.appearances.length; i++) {
        const prev = entry.appearances[i - 1];
        const curr = entry.appearances[i];
        expect(curr.media >= prev.media).toBe(true);
      }
    }
  });

  it('minimal fixture works correctly', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const staleness = computeStaleness(model);
    const index = buildReshootIndex(model, staleness);
    expect(Array.isArray(index)).toBe(true);
    expect(index.length).toBeGreaterThan(0);
  });
});
