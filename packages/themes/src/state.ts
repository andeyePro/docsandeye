/**
 * The theme state shared by the <docsi-theme> element and the first-paint
 * head script: names, storage keys, the cycle order and the parsers.
 *
 * A state is `<pack>-<mode>`, for example `pioreactor-dark`. The pack is the
 * name of the theme pack (`docsandeye.config.yaml` `theme:`) or Starlight's
 * stock `starlight`; the mode is `auto` (follow the operating system), `light`
 * or `dark`.
 */

/** `localStorage` key holding the current state. */
export const STORAGE_KEY = 'docsandeye-theme';

/** Starlight's own key; read on first load, kept in step afterwards. */
export const STARLIGHT_STORAGE_KEY = 'starlight-theme';

/** The stock pack shipped inside starlight-docsandeye. */
export const STOCK_PACK = 'starlight';

/** The media query Starlight resolves `auto` against. */
export const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';

export const MODES = ['auto', 'light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

export interface ThemeState {
  pack: string;
  mode: Mode;
}

const PACK_RE = /^[a-z0-9][a-z0-9-]*$/;

export function isMode(value: unknown): value is Mode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/**
 * The cycle for a site whose config pack is `pack`:
 * pack auto → pack light → pack dark → starlight auto → starlight dark → starlight light.
 * A site on the stock pack has only the three Starlight states.
 */
export function cycleFor(pack: string): ThemeState[] {
  const starlight: ThemeState[] = [
    { pack: STOCK_PACK, mode: 'auto' },
    { pack: STOCK_PACK, mode: 'dark' },
    { pack: STOCK_PACK, mode: 'light' },
  ];
  if (pack === STOCK_PACK) return starlight;
  return [{ pack, mode: 'auto' }, { pack, mode: 'light' }, { pack, mode: 'dark' }, ...starlight];
}

export function formatState(state: ThemeState): string {
  return `${state.pack}-${state.mode}`;
}

/** Parse a stored value; `undefined` when it is not a well-formed state. */
export function parseState(value: unknown): ThemeState | undefined {
  if (typeof value !== 'string') return undefined;
  const at = value.lastIndexOf('-');
  if (at < 1) return undefined;
  const pack = value.slice(0, at);
  const mode = value.slice(at + 1);
  if (!PACK_RE.test(pack) || !isMode(mode)) return undefined;
  return { pack, mode };
}

export function sameState(a: ThemeState, b: ThemeState): boolean {
  return a.pack === b.pack && a.mode === b.mode;
}

/** The state after `current` in the cycle; unknown states restart at the first. */
export function nextState(cycle: readonly ThemeState[], current: ThemeState): ThemeState {
  const index = cycle.findIndex((s) => sameState(s, current));
  return cycle[(index + 1) % cycle.length] ?? cycle[0]!;
}

/** `light` or `dark` for `mode`, resolving `auto` the way Starlight does. */
export function resolveMode(mode: Mode, prefersLight: boolean): 'light' | 'dark' {
  if (mode === 'auto') return prefersLight ? 'light' : 'dark';
  return mode;
}

/** Map Starlight's stored value (`light`, `dark`, anything else = auto) onto `pack`. */
export function fromStarlight(value: unknown, pack: string): ThemeState {
  return { pack, mode: value === 'light' || value === 'dark' ? value : 'auto' };
}

/** What Starlight stores for a mode: `light`, `dark`, or the empty string for auto. */
export function toStarlight(mode: Mode): string {
  return mode === 'auto' ? '' : mode;
}

/** Human label for a pack name: `pioreactor` → `Pioreactor`, `my-pack` → `My pack`. */
export function packLabel(pack: string): string {
  const words = pack.split('-').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The state label read out by assistive technology. */
export function stateLabel(state: ThemeState): string {
  const pack = packLabel(state.pack);
  return state.mode === 'auto' ? `${pack}, follows system` : `${pack} ${state.mode}`;
}
