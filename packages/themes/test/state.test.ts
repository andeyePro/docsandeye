import { describe, it, expect } from 'vitest';
import {
  MODES,
  STOCK_PACK,
  cycleFor,
  formatState,
  fromStarlight,
  nextState,
  parseState,
  resolveMode,
  sameState,
  toStarlight,
  type ThemeState,
} from '../src/state.ts';

describe('cycleFor: six-state cycle order and wrap-around', () => {
  it('for a config pack, cycles pack auto -> pack light -> pack dark -> starlight auto -> starlight dark -> starlight light', () => {
    const cycle = cycleFor('pioreactor');
    expect(cycle).toEqual<ThemeState[]>([
      { pack: 'pioreactor', mode: 'auto' },
      { pack: 'pioreactor', mode: 'light' },
      { pack: 'pioreactor', mode: 'dark' },
      { pack: 'starlight', mode: 'auto' },
      { pack: 'starlight', mode: 'dark' },
      { pack: 'starlight', mode: 'light' },
    ]);
  });

  it('for the stock pack, has only the three Starlight states', () => {
    const cycle = cycleFor(STOCK_PACK);
    expect(cycle).toEqual<ThemeState[]>([
      { pack: 'starlight', mode: 'auto' },
      { pack: 'starlight', mode: 'dark' },
      { pack: 'starlight', mode: 'light' },
    ]);
  });

  it('nextState advances through the full six-state cycle in order', () => {
    const cycle = cycleFor('pioreactor');
    let state = cycle[0]!;
    const seen: ThemeState[] = [state];
    for (let i = 0; i < cycle.length - 1; i++) {
      state = nextState(cycle, state);
      seen.push(state);
    }
    expect(seen).toEqual(cycle);
  });

  it('nextState wraps around from the last state back to the first', () => {
    const cycle = cycleFor('pioreactor');
    const last = cycle[cycle.length - 1]!;
    expect(nextState(cycle, last)).toEqual(cycle[0]);
  });

  it('nextState wraps around for the stock-pack (three-state) cycle', () => {
    const cycle = cycleFor(STOCK_PACK);
    const last = cycle[cycle.length - 1]!;
    expect(nextState(cycle, last)).toEqual(cycle[0]);
  });

  it('nextState restarts at the first state for an unknown current state', () => {
    const cycle = cycleFor('pioreactor');
    const unknown: ThemeState = { pack: 'nonexistent', mode: 'auto' };
    expect(nextState(cycle, unknown)).toEqual(cycle[0]);
  });
});

describe('parseState / formatState', () => {
  it('formats a state as pack-mode', () => {
    expect(formatState({ pack: 'pioreactor', mode: 'dark' })).toBe('pioreactor-dark');
    expect(formatState({ pack: 'starlight', mode: 'auto' })).toBe('starlight-auto');
  });

  it('parses a well-formed value back into a state', () => {
    expect(parseState('pioreactor-dark')).toEqual({ pack: 'pioreactor', mode: 'dark' });
    expect(parseState('starlight-auto')).toEqual({ pack: 'starlight', mode: 'auto' });
  });

  it('round-trips every mode for a multi-segment pack name', () => {
    for (const mode of MODES) {
      const state: ThemeState = { pack: 'my-pack', mode };
      expect(parseState(formatState(state))).toEqual(state);
    }
  });

  it('returns undefined for a non-string value', () => {
    expect(parseState(undefined)).toBeUndefined();
    expect(parseState(null)).toBeUndefined();
    expect(parseState(42)).toBeUndefined();
  });

  it('returns undefined when there is no separator', () => {
    expect(parseState('pioreactor')).toBeUndefined();
  });

  it('returns undefined for an invalid mode suffix', () => {
    expect(parseState('pioreactor-neon')).toBeUndefined();
  });

  it('returns undefined for an empty pack', () => {
    expect(parseState('-dark')).toBeUndefined();
  });

  it('returns undefined for a pack with invalid characters', () => {
    expect(parseState('Pioreactor-dark')).toBeUndefined();
    expect(parseState('pio_reactor-dark')).toBeUndefined();
  });
});

describe('Starlight starlight-theme mapping', () => {
  it('fromStarlight maps "light" and "dark" through, anything else to auto', () => {
    expect(fromStarlight('light', 'pioreactor')).toEqual({ pack: 'pioreactor', mode: 'light' });
    expect(fromStarlight('dark', 'pioreactor')).toEqual({ pack: 'pioreactor', mode: 'dark' });
    expect(fromStarlight('', 'pioreactor')).toEqual({ pack: 'pioreactor', mode: 'auto' });
    expect(fromStarlight(null, 'pioreactor')).toEqual({ pack: 'pioreactor', mode: 'auto' });
    expect(fromStarlight(undefined, 'pioreactor')).toEqual({ pack: 'pioreactor', mode: 'auto' });
    expect(fromStarlight('something-else', 'pioreactor')).toEqual({ pack: 'pioreactor', mode: 'auto' });
  });

  it('toStarlight maps light/dark through and auto to the empty string', () => {
    expect(toStarlight('light')).toBe('light');
    expect(toStarlight('dark')).toBe('dark');
    expect(toStarlight('auto')).toBe('');
  });

  it('toStarlight and fromStarlight round-trip for light and dark', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(fromStarlight(toStarlight(mode), 'pioreactor').mode).toBe(mode);
    }
  });
});

describe('<html> attribute derivation per state (resolveMode)', () => {
  it('resolves an explicit light or dark mode to itself regardless of OS preference', () => {
    expect(resolveMode('light', true)).toBe('light');
    expect(resolveMode('light', false)).toBe('light');
    expect(resolveMode('dark', true)).toBe('dark');
    expect(resolveMode('dark', false)).toBe('dark');
  });

  it('resolves auto to light when the OS prefers light', () => {
    expect(resolveMode('auto', true)).toBe('light');
  });

  it('resolves auto to dark when the OS does not prefer light', () => {
    expect(resolveMode('auto', false)).toBe('dark');
  });

  it('derives the data-theme attribute value for every state in a pack cycle', () => {
    const cycle = cycleFor('pioreactor');
    const dataThemeFor = (state: ThemeState, prefersLight: boolean) => resolveMode(state.mode, prefersLight);

    // pack-auto and starlight-auto follow the OS; every other state is fixed.
    expect(dataThemeFor(cycle[0]!, true)).toBe('light'); // pioreactor-auto, OS light
    expect(dataThemeFor(cycle[0]!, false)).toBe('dark'); // pioreactor-auto, OS dark
    expect(dataThemeFor(cycle[1]!, false)).toBe('light'); // pioreactor-light, OS dark
    expect(dataThemeFor(cycle[2]!, true)).toBe('dark'); // pioreactor-dark, OS light
    expect(dataThemeFor(cycle[3]!, true)).toBe('light'); // starlight-auto, OS light
    expect(dataThemeFor(cycle[4]!, true)).toBe('dark'); // starlight-dark, OS light
    expect(dataThemeFor(cycle[5]!, false)).toBe('light'); // starlight-light, OS dark
  });
});

describe('sameState', () => {
  it('is true only when pack and mode both match', () => {
    expect(sameState({ pack: 'a', mode: 'auto' }, { pack: 'a', mode: 'auto' })).toBe(true);
    expect(sameState({ pack: 'a', mode: 'auto' }, { pack: 'b', mode: 'auto' })).toBe(false);
    expect(sameState({ pack: 'a', mode: 'auto' }, { pack: 'a', mode: 'dark' })).toBe(false);
  });
});
