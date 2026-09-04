/**
 * `<docsi-theme data-pack="…">`: the six-state theme control that replaces
 * Starlight's theme select.
 *
 * Server-rendered light DOM (see ThemeSelect.astro):
 *   <docsi-theme hidden data-pack="pioreactor">
 *     <template data-base="auto" data-mark-transform="…">…svg…</template>
 *     <template data-base="light">…svg…</template>
 *     <template data-base="dark" data-mark-transform="…">…svg…</template>
 *     <template data-mark>…svg…</template>
 *     <span data-label>Theme</span>
 *   </docsi-theme>
 *
 * On upgrade the element removes `hidden`, renders one <button> holding the
 * state's base icon with the mark cut out through an SVG mask (pack states)
 * or the plain base (Starlight states), and a visually hidden label. Click,
 * Enter or Space advance the cycle. The element writes `data-docsi-pack` and
 * `data-theme` on <html>, stores the state in localStorage['docsandeye-theme']
 * and mirrors the mode into Starlight's `starlight-theme` so Starlight's own
 * first-paint script agrees with it. Without JavaScript the control stays
 * hidden and the page renders in the config's pack.
 */
import {
  LIGHT_SCHEME_QUERY,
  STARLIGHT_STORAGE_KEY,
  STOCK_PACK,
  STORAGE_KEY,
  cycleFor,
  formatState,
  fromStarlight,
  nextState,
  parseState,
  resolveMode,
  sameState,
  stateLabel,
  toStarlight,
  type ThemeState,
} from './state.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_SIZE = 24;

let maskCounter = 0;
let current: ThemeState | undefined;
const instances = new Set<DocsiTheme>();

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or storage disabled: the state still applies to this page */
  }
}

function prefersLight(): boolean {
  return typeof matchMedia === 'function' && matchMedia(LIGHT_SCHEME_QUERY).matches;
}

/** The stored state for a site whose config pack is `pack`, or the mapped Starlight preference. */
export function loadState(pack: string): ThemeState {
  const stored = parseState(storageGet(STORAGE_KEY));
  if (stored && (stored.pack === pack || stored.pack === STOCK_PACK)) return stored;
  return fromStarlight(storageGet(STARLIGHT_STORAGE_KEY), pack);
}

/** Write `state` to <html>, storage and every rendered control. */
export function applyState(state: ThemeState, persist = true): void {
  current = state;
  const root = document.documentElement;
  root.dataset.docsiPack = state.pack;
  root.dataset.theme = resolveMode(state.mode, prefersLight());
  if (persist) {
    storageSet(STORAGE_KEY, formatState(state));
    storageSet(STARLIGHT_STORAGE_KEY, toStarlight(state.mode));
  }
  for (const instance of instances) instance.render(state);
}

let watching = false;

/** Follow the OS colour scheme (for `auto`) and other tabs' choices; registered once. */
export function watchEnvironment(): void {
  if (watching) return;
  watching = true;
  if (typeof matchMedia === 'function') {
    matchMedia(LIGHT_SCHEME_QUERY).addEventListener('change', () => {
      if (current?.mode === 'auto') applyState(current, false);
    });
  }
  addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !current) return;
    const state = parseState(event.newValue);
    if (state && !sameState(state, current)) applyState(state, false);
  });
}

function cloneSvgChildren(template: HTMLTemplateElement | null, into: SVGElement): void {
  const svg = template?.content.querySelector('svg');
  if (!svg) return;
  for (const child of Array.from(svg.childNodes)) into.appendChild(child.cloneNode(true));
}

export class DocsiTheme extends HTMLElement {
  #button: HTMLButtonElement | undefined;
  #text: HTMLSpanElement | undefined;
  #cycle: ThemeState[] = [];
  #labelPrefix = 'Theme';

  connectedCallback(): void {
    if (this.#button) return;
    const pack = this.dataset.pack || STOCK_PACK;
    this.#cycle = cycleFor(pack);
    this.#labelPrefix = this.querySelector<HTMLElement>('[data-label]')?.textContent?.trim() || 'Theme';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'docsi-theme-button';
    button.addEventListener('click', () => this.advance());
    const text = document.createElement('span');
    text.className = 'docsi-theme-text';
    button.append(text);
    this.#button = button;
    this.#text = text;
    this.append(button);

    instances.add(this);
    watchEnvironment();
    applyState(current ?? loadState(pack), current === undefined);
    this.removeAttribute('hidden');
  }

  disconnectedCallback(): void {
    instances.delete(this);
  }

  /** Move to the next state in the cycle. */
  advance(): void {
    const from = current ?? this.#cycle[0]!;
    applyState(nextState(this.#cycle, from));
  }

  /** The state currently shown. */
  get state(): ThemeState | undefined {
    return current;
  }

  render(state: ThemeState): void {
    const button = this.#button;
    const text = this.#text;
    if (!button || !text) return;
    const label = stateLabel(state);
    button.setAttribute('aria-label', `${this.#labelPrefix}: ${label}. Activate to change.`);
    button.dataset.state = formatState(state);
    text.textContent = label;
    button.querySelector('svg')?.remove();
    button.prepend(this.#icon(state));
  }

  #icon(state: ThemeState): SVGSVGElement {
    const base = this.querySelector<HTMLTemplateElement>(`template[data-base="${state.mode}"]`);
    const mark = this.querySelector<HTMLTemplateElement>('template[data-mark]');
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${ICON_SIZE} ${ICON_SIZE}`);
    svg.setAttribute('width', String(ICON_SIZE));
    svg.setAttribute('height', String(ICON_SIZE));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const shape = document.createElementNS(SVG_NS, 'g');
    cloneSvgChildren(base, shape);

    // Pack states carry the mark cut out of the base; Starlight states show the bare base.
    if (state.pack !== STOCK_PACK && mark) {
      const id = `docsi-theme-mask-${++maskCounter}`;
      const maskEl = document.createElementNS(SVG_NS, 'mask');
      maskEl.setAttribute('id', id);
      maskEl.setAttribute('maskUnits', 'userSpaceOnUse');
      maskEl.setAttribute('x', '0');
      maskEl.setAttribute('y', '0');
      maskEl.setAttribute('width', String(ICON_SIZE));
      maskEl.setAttribute('height', String(ICON_SIZE));
      const keep = document.createElementNS(SVG_NS, 'rect');
      keep.setAttribute('width', String(ICON_SIZE));
      keep.setAttribute('height', String(ICON_SIZE));
      keep.setAttribute('fill', '#fff');
      const cut = document.createElementNS(SVG_NS, 'g');
      cut.setAttribute('fill', '#000');
      cut.setAttribute('stroke', '#000');
      const transform = base?.dataset.markTransform;
      if (transform) cut.setAttribute('transform', transform);
      cloneSvgChildren(mark, cut);
      maskEl.append(keep, cut);
      shape.setAttribute('mask', `url(#${id})`);
      svg.append(maskEl);
    }
    svg.append(shape);
    return svg;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('docsi-theme')) {
  customElements.define('docsi-theme', DocsiTheme);
}
