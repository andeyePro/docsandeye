/**
 * `<docsi-video>`: a facade around a plain `<video preload="none">`. The
 * server renders the complete element — poster, the lowest offered rendition
 * pair (AV1 first, H.264 second), captions, a `<noscript>` download link — so
 * the page is legible and the clip playable without JavaScript. On upgrade
 * this element unhides the version banner (and keeps it visible for the whole
 * playback), switches both `<source>` elements to the 1080 pair when the
 * device and network warrant it, and wires the STALE flow's
 * "Watch the older video" button. No video bytes move until the visitor
 * presses play; no library is imported.
 *
 * `pickRendition` and `bannerText` are pure and unit-tested in Node.
 */

export type VideoStatus = 'FRESH' | 'CHANGED_IN_FRAME' | 'STALE';

/** A staleness pin with the component's display name resolved (falls back to the id). */
export interface BannerPin {
  component?: string;
  name?: string;
  shot_with: string;
  current: string;
}

export interface BannerRecord {
  stale_heroes: readonly BannerPin[];
  changed_in_frame: readonly BannerPin[];
}

export interface RenditionSignals {
  /** `navigator.connection.saveData` */
  saveData?: boolean;
  /** `navigator.connection.effectiveType` (`slow-2g` | `2g` | `3g` | `4g`) */
  effectiveType?: string;
  /** `(prefers-reduced-data: reduce)` */
  reducedData?: boolean;
  /** `devicePixelRatio` */
  dpr?: number;
  /** viewport width in CSS pixels */
  width?: number;
  /** Rendition heights offered by the page, e.g. `[720, 1080]`. */
  available: readonly number[];
}

export const SLOW_EFFECTIVE_TYPES: readonly string[] = ['slow-2g', '2g', '3g'];
/** Physical pixels of viewport width at which 1080 is worth its bytes. */
export const HD_MIN_PHYSICAL_WIDTH = 1280;
export const AV1_SOURCE_TYPE = 'video/webm; codecs=av01.0.05M.08';
export const H264_SOURCE_TYPE = 'video/mp4';

/**
 * The rendition to load: the lowest available whenever the visitor asked for
 * less data (`saveData`, a slow connection, `prefers-reduced-data`); otherwise
 * 1080 iff it is available and the viewport is at least 1280 physical pixels
 * wide; else the lowest available.
 */
export function pickRendition(signals: RenditionSignals): number {
  const sorted = [...signals.available].filter((h) => Number.isFinite(h)).sort((a, b) => a - b);
  const lowest = sorted[0] ?? 720;
  const slow = signals.effectiveType !== undefined && SLOW_EFFECTIVE_TYPES.includes(signals.effectiveType);
  if (signals.saveData === true || signals.reducedData === true || slow) return lowest;
  const physicalWidth = (signals.dpr ?? 1) * (signals.width ?? 0);
  if (sorted.includes(1080) && physicalWidth >= HD_MIN_PHYSICAL_WIDTH) return 1080;
  return lowest;
}

/**
 * `Recorded with <name> v<shot_with>, current is v<current>` for the first
 * stale hero (STALE) or the first changed in-frame component
 * (CHANGED_IN_FRAME); `null` for FRESH.
 */
export function bannerText(status: VideoStatus | string, record: BannerRecord): string | null {
  const pin = status === 'STALE' ? record.stale_heroes[0] : status === 'CHANGED_IN_FRAME' ? record.changed_in_frame[0] : undefined;
  if (!pin) return null;
  const name = pin.name ?? pin.component ?? 'this component';
  return `Recorded with ${name} v${pin.shot_with}, current is v${pin.current}`;
}

/** `"720,1080"` → `[720, 1080]`; `"source"` (degraded mode) → `[]`. */
export function parseRenditions(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((h) => Number.isFinite(h) && h > 0);
}

/** `…/vid-02-seat-720.webm` → `…/vid-02-seat-1080.webm` (the encode pipeline's naming). */
export function renditionUrl(src: string, height: number): string {
  return src.replace(/-\d+(\.[A-Za-z0-9]+)(?=$|[?#])/, `-${height}$1`);
}

interface ConnectionInfo {
  saveData?: boolean;
  effectiveType?: string;
}

/** Read the rendition signals from the browser. */
export function currentSignals(available: readonly number[], win: Window = window): RenditionSignals {
  const connection = (win.navigator as Navigator & { connection?: ConnectionInfo }).connection;
  return {
    saveData: connection?.saveData === true,
    effectiveType: connection?.effectiveType,
    reducedData: typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-data: reduce)').matches,
    dpr: win.devicePixelRatio || 1,
    width: win.innerWidth || win.document.documentElement.clientWidth,
    available,
  };
}

/**
 * Point both `<source>` elements at the `height` pair. Only before playback
 * has started (the element upgrades before the visitor can press play);
 * `load()` re-runs source selection and, with `preload="none"`, fetches
 * nothing.
 */
export function swapRendition(video: HTMLVideoElement, height: number): boolean {
  if (!video.paused || video.currentTime > 0) return false;
  let changed = false;
  for (const source of video.querySelectorAll('source[data-height]')) {
    const src = source.getAttribute('src');
    if (!src) continue;
    const next = renditionUrl(src, height);
    if (next === src) continue;
    source.setAttribute('src', next);
    source.setAttribute('data-height', String(height));
    changed = true;
  }
  if (changed) video.load();
  return changed;
}

// The module is also imported server-side (Astro) and in Node unit tests,
// where there is no HTMLElement to extend.
const ElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class DocsiVideo extends ElementBase {
  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');

    // The banner is persistent: shown on upgrade, never hidden again.
    const banner = this.querySelector<HTMLElement>('.docsi-banner');
    if (banner) banner.hidden = false;

    const video = this.querySelector('video');
    if (video) {
      video.removeAttribute('autoplay');
      video.preload = 'none';
      this.upgradeRendition(video);
    }
    this.wireOlderButton();
  }

  /** Switch to the 1080 pair when offered and warranted; otherwise keep the server's lowest pair. */
  private upgradeRendition(video: HTMLVideoElement): void {
    const available = parseRenditions(this.dataset.renditions);
    if (!available.includes(1080)) return;
    if (pickRendition(currentSignals(available)) !== 1080) return;
    swapRendition(video, 1080);
  }

  /** STALE flow: the `Watch the older video` button reveals the hidden `.docsi-older` box; nothing plays. */
  private wireOlderButton(): void {
    const older = this.closest<HTMLElement>('.docsi-older');
    if (!older) return;
    const button = older.closest('details')?.querySelector<HTMLButtonElement>('button.docsi-watch-older');
    if (!button || button.hasAttribute('data-enhanced')) return;
    button.setAttribute('data-enhanced', '');
    button.addEventListener(
      'click',
      () => {
        older.hidden = false;
        button.hidden = true;
        this.setAttribute('data-revealed', '');
      },
      { once: true },
    );
  }
}
