/**
 * Pure view helpers shared by the Astro components (and unit-testable
 * without Astro): URLs, staleness wording, sidebar badges, carbon lookup.
 */
import {
  renderJobKey,
  resolveMediaUrl,
  type Component,
  type Guide,
  type HostingConfig,
  type Media,
  type ProjectModel,
  type StalenessEntry,
  type StalenessReport,
  type StalePin,
  type Step,
} from '@docsandeye/core';
import type { CarbonPage, CarbonReport, RenderManifest, RenderManifestJob } from './data.ts';

export const RENDER_URL_PREFIX = '/_docsandeye/render/';
export const MEDIA_URL_PREFIX = '/_docsandeye/media/';
export const UPDATED_WINDOW_DAYS = 30;

// ---------------------------------------------------------------------------
// Paths and URLs

export function basename(file: string): string {
  const parts = file.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || file;
}

/**
 * Percent-encode every segment of a site-root-relative path, keeping `/` as the
 * separator: `_docsandeye/render/BlankCap v1.stl` →
 * `_docsandeye/render/BlankCap%20v1.stl`.
 *
 * Derived files and media outputs are named by whatever the maintainer's CAD or
 * camera wrote, so a space, a `#` or a `?` in a basename is ordinary. Emitted
 * verbatim into an `href`/`src` a `#` truncates the URL at the fragment and a
 * space is at best browser-repaired; encoded, the server still resolves them,
 * because the copy step keeps the on-disk basename unencoded (see `assets.ts`)
 * and both static hosts and the dev-server handler decode before looking up.
 */
export function encodePathSegments(pathname: string): string {
  return pathname.split('/').map(encodeURIComponent).join('/');
}

/**
 * Prefix a site-root-relative path with Astro's `BASE_URL` (`/`, `/docs/`,
 * `/docs`), percent-encoding the path's own segments. `siteBase` comes from the
 * site config and is passed through as authored.
 */
export function withBase(pathname: string, siteBase = '/'): string {
  const base = siteBase.replace(/\/+$/, '');
  return `${base}/${encodePathSegments(pathname.replace(/^\/+/, ''))}`;
}

/** Guide `base` segments (`/AEP` → `['AEP']`, `/` → `[]`). */
export function guideSegments(guide: Pick<Guide, 'base'>): string[] {
  return guide.base.split('/').filter(Boolean);
}

/** Route pattern for a guide index: `/AEP`; the root guide is `/`. */
export function guidePattern(guide: Pick<Guide, 'base'>): string {
  return `/${guideSegments(guide).join('/')}`;
}

export function guideHref(guide: Pick<Guide, 'base'>, siteBase = '/'): string {
  const segments = guideSegments(guide);
  return withBase(segments.length ? `${segments.join('/')}/` : '', siteBase);
}

export function stepHref(guide: Pick<Guide, 'base'>, stepId: string, siteBase = '/'): string {
  return withBase(`${[...guideSegments(guide), stepId].join('/')}/`, siteBase);
}

/** Find the guide whose base matches an injected route pattern (`/AEP` or `/AEP/[step]`). */
export function guideForRoutePattern<G extends Pick<Guide, 'base'>>(guides: readonly G[], routePattern: string): G | undefined {
  const wanted = `/${routePattern.replace(/\/\[step\]$/, '').split('/').filter(Boolean).join('/')}`;
  return guides.find((g) => guidePattern(g) === wanted);
}

// ---------------------------------------------------------------------------
// Renders and media

/** `f3z` and `none` masters are hand-exported: their outputs are the component's `derived_files`, not a rendered file. */
export function isHandExported(component: Pick<Component, 'master_format'>): boolean {
  return component.master_format === 'f3z' || component.master_format === 'none';
}

/**
 * The manifest job that carries a hand-exported component's derived files.
 *
 * Core's render plan emits ONE job per distinct `outputs` list for such a
 * component — de-duplicated on `outputs[0]`, keeping whichever key sorts first
 * — because every reference would otherwise ask the pipeline to produce the
 * same bytes. So a component referenced by two step renders, or by a render
 * and a viewer, has a manifest entry under only ONE of their `renderJobKey`s;
 * the others must be resolved by what the job writes instead of by its key.
 *
 * Match on the outputs, in key order for determinism: the whole `outputs` list
 * when it equals `derived_files`, else the first job whose `outputs[0]` does.
 * Undefined when there is no manifest, no derived file to key on, or nothing
 * in the manifest writes it.
 */
export function handExportedJobFor(
  manifest: RenderManifest | null,
  component: Pick<Component, 'derived_files'>,
): { key: string; job: RenderManifestJob } | undefined {
  const wanted = component.derived_files;
  if (!manifest || wanted.length === 0 || wanted[0] === undefined) return undefined;
  let byFirstOutput: { key: string; job: RenderManifestJob } | undefined;
  for (const key of Object.keys(manifest.jobs).sort()) {
    const job = manifest.jobs[key]!;
    if (job.outputs.length === wanted.length && job.outputs.every((o, i) => o === wanted[i])) return { key, job };
    if (byFirstOutput === undefined && job.outputs[0] === wanted[0]) byFirstOutput = { key, job };
  }
  return byFirstOutput;
}

/**
 * The manifest job behind one step render or viewer. Rendered components are
 * looked up by `renderJobKey`, which is unique per reference. Hand-exported
 * components are looked up by outputs (see `handExportedJobFor`), because the
 * plan has collapsed all their references into a single job; the returned
 * `key` is then that job's own key, which need not be this reference's.
 */
export function renderJobFor(
  model: ProjectModel,
  manifest: RenderManifest | null,
  componentId: string,
  renderId: string,
  options: Parameters<typeof renderJobKey>[2],
): { key: string; job: RenderManifestJob | undefined } | undefined {
  const component = model.components.get(componentId);
  if (!component) return undefined;
  const key = renderJobKey(component, renderId, options);
  if (isHandExported(component)) {
    const found = handExportedJobFor(manifest, component);
    if (found) return found;
  }
  return { key, job: manifest?.jobs[key] };
}

/** URL of one render output (by basename) under `/_docsandeye/render/`, percent-encoded. */
export function renderOutputUrl(output: string, siteBase = '/'): string {
  return withBase(`${RENDER_URL_PREFIX}${basename(output)}`, siteBase);
}

/** URL of a render job's first output under `/_docsandeye/render/`. */
export function renderUrl(job: RenderManifestJob, siteBase = '/'): string | undefined {
  const output = job.outputs[0];
  return output ? renderOutputUrl(output, siteBase) : undefined;
}

/** Extensions a browser can put in an `<img>`; anything else is a download or a 3D model. */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(['.png', '.svg', '.webp', '.avif', '.jpg', '.jpeg']);
/** Extensions `<docsi-model>`'s viewer can load. */
export const MODEL_EXTENSIONS: ReadonlySet<string> = new Set(['.glb', '.gltf']);

/** Lower-cased extension including the dot (`''` when there is none). */
export function extension(file: string): string {
  const name = basename(file);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

export function isImageOutput(file: string): boolean {
  return IMAGE_EXTENSIONS.has(extension(file));
}

export function isViewableModel(file: string): boolean {
  return MODEL_EXTENSIONS.has(extension(file));
}

/** How a step render's resolved output can be shown on the page. */
export type RenderPresentation =
  | { kind: 'image'; url: string }
  | { kind: 'model'; url: string }
  | { kind: 'download'; url: string; filename: string };

/**
 * What to put in a step render's figure.
 *
 * A rendered component writes an image and gets an `<img>`. A hand-exported one
 * (`f3z`/`none`) is shown through whatever its derived files actually are: an
 * `.stl`/`.step`/`.3mf` is not an image, and an `<img>` pointing at one renders
 * as a broken image, so it becomes `<docsi-model>` when a `.glb`/`.gltf` exists
 * to view — the job's own outputs first, then the component's other derived
 * files — and a download link otherwise.
 */
export function renderPresentation(
  job: RenderManifestJob,
  component: Pick<Component, 'derived_files'> | undefined,
  siteBase = '/',
): RenderPresentation | undefined {
  const output = job.outputs[0];
  if (output === undefined) return undefined;
  if (isImageOutput(output)) return { kind: 'image', url: renderOutputUrl(output, siteBase) };
  const model = [...job.outputs, ...(component?.derived_files ?? [])].find(isViewableModel);
  if (model !== undefined) return { kind: 'model', url: renderOutputUrl(model, siteBase) };
  return { kind: 'download', url: renderOutputUrl(output, siteBase), filename: basename(output) };
}

/** URL of a media file or poster: copied under `/_docsandeye/media/` for local hosting, else via the hosting provider. */
export function mediaUrl(media: Media, kind: 'file' | 'poster', hosting: HostingConfig, siteBase = '/'): string | undefined {
  const file = kind === 'file' ? media.file : media.poster;
  if (!file) return undefined;
  if (hosting.provider === 'local') return withBase(`${MEDIA_URL_PREFIX}${basename(file)}`, siteBase);
  return resolveMediaUrl(hosting, file);
}

// ---------------------------------------------------------------------------
// Staleness wording

export function componentName(model: ProjectModel, id: string): string {
  return model.components.get(id)?.name ?? id;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** `{ names: 'Vial Cap', verb: 'has', versions: 'v1.0.0 → v2.0.0' }` for a list of changed pins. */
export function describeChanges(pins: readonly StalePin[], model: ProjectModel): { names: string; verb: string; versions: string } {
  return {
    names: joinNames(pins.map((p) => componentName(model, p.component))),
    verb: pins.length > 1 ? 'have' : 'has',
    versions: pins.map((p) => `v${p.shot_with} → v${p.current}`).join('; '),
  };
}

export function mediaVerb(type: Media['type']): string {
  return type === 'video' ? 'filmed' : 'taken';
}

/** `<summary>` text for a STALE media item. */
export function staleSummary(media: Media, entry: StalenessEntry, model: ProjectModel): string {
  const { names, verb, versions } = describeChanges(entry.stale_heroes, model);
  return `A ${media.type} exists for this step, but ${names} ${verb} changed since it was ${mediaVerb(media.type)} (${versions})`;
}

/** Note under a CHANGED_IN_FRAME media item. */
export function changedInFrameNote(media: Media, entry: StalenessEntry, model: ProjectModel): string {
  const { names, verb, versions } = describeChanges(entry.changed_in_frame, model);
  const appears = entry.changed_in_frame.length > 1 ? 'appear' : 'appears';
  return `${names} also ${appears} in this ${media.type} and ${verb} changed since it was ${mediaVerb(media.type)} (${versions}).`;
}

// ---------------------------------------------------------------------------
// Sidebar badges

/** Component ids a step depends on: parts, tools, renders, viewer, and the pins of its media. */
export function componentsReferencedByStep(step: Step, model: ProjectModel): Set<string> {
  const ids = new Set<string>();
  for (const p of step.parts) ids.add(p.component);
  for (const t of step.tools) ids.add(t.component);
  for (const r of step.renders) ids.add(r.component);
  if (step.viewer) ids.add(step.viewer.component);
  for (const mediaId of step.media ?? []) {
    const media = model.media.get(mediaId);
    if (!media) continue;
    for (const pin of [...media.hero, ...media.in_frame]) {
      const at = pin.indexOf('@');
      ids.add(at === -1 ? pin : pin.slice(0, at));
    }
  }
  return ids;
}

export function latestChangelogDate(component: Component): string | undefined {
  let latest: string | undefined;
  for (const entry of component.changelog ?? []) {
    if (latest === undefined || entry.date > latest) latest = entry.date;
  }
  return latest;
}

/** Whole days from `from` to `to` (ISO dates); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** True when the component's latest changelog entry is dated within `windowDays` before `buildDate` (or later). */
export function isRecentlyUpdated(component: Component, buildDate: string, windowDays = UPDATED_WINDOW_DAYS): boolean {
  const latest = latestChangelogDate(component);
  if (latest === undefined) return false;
  return daysBetween(latest, buildDate) <= windowDays;
}

export interface StepBadges {
  /** Some media of the step is STALE. */
  stale: boolean;
  /** Some component the step depends on was updated within the window. */
  updated: boolean;
}

export function stepBadges(step: Step, model: ProjectModel, staleness: StalenessReport, buildDate: string): StepBadges {
  const stale = (step.media ?? []).some((id) => staleness[id]?.status === 'STALE');
  let updated = false;
  for (const id of componentsReferencedByStep(step, model)) {
    const component = model.components.get(id);
    if (component && isRecentlyUpdated(component, buildDate)) {
      updated = true;
      break;
    }
  }
  return { stale, updated };
}

// ---------------------------------------------------------------------------
// Carbon

/** Normalise a pathname to the `carbon.json` key form: leading and trailing slash. */
export function carbonKey(pathname: string): string {
  const inner = pathname.split('/').filter(Boolean).join('/');
  return inner ? `/${inner}/` : '/';
}

export function carbonFor(carbon: CarbonReport | null, pathname: string): CarbonPage | undefined {
  return carbon?.pages[carbonKey(pathname)];
}

export function formatCarbon(gco2e: number): string {
  return `≈ ${gco2e.toFixed(2)} g CO₂e per view`;
}

export function partsCount(step: Step): number {
  return step.parts.length;
}
