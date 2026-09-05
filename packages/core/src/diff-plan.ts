/**
 * Diff plan (`build/diff-plan.json`) consumed by `docsandeye diff`: for every
 * STALE media record, the changed hero component's derived geometry as it was
 * at the recorded version (`shot_with`) is restored from git history and
 * converted to GLB so the plugin can show old and new side by side.
 *
 * One job per distinct `(component, shot_with)` pair across the `stale_heroes`
 * of STALE media only (CHANGED_IN_FRAME pins are a later slice). `candidates`
 * lists the component's `derived_files` that a restore can use: every `.glb`
 * first, then every `.stl`, each group in its original order; other extensions
 * are ignored. A component with no usable derived file still yields a job (with
 * `candidates: []`) so the CLI can report it as skipped. Jobs are sorted by key.
 */
import type { ProjectModel } from './load.js';
import type { StalenessReport } from './staleness.js';

export const DIFF_PLAN_VERSION = 1 as const;
export const OLD_RENDER_OUTPUT_DIR = 'build/render/old';

export interface DiffJob {
  /** `<component>@<version>` — also the cache key and the output file stem. */
  key: string;
  component: string;
  /** The recorded version (`shot_with`). */
  version: string;
  /** The component's current `design_version`. */
  current: string;
  /** Repo-relative path of the component YAML (`docs/components/<id>.yaml`). */
  component_file: string;
  /** Derived files to try, `.glb` first then `.stl`, both in their original order. */
  candidates: string[];
  /** `build/render/old/<key>.glb`. */
  output: string;
  /** Ids of the STALE media that pinned this pair, sorted. */
  media: string[];
}

export interface DiffPlan {
  version: typeof DIFF_PLAN_VERSION;
  jobs: DiffJob[];
}

const GLB_RE = /\.glb$/i;
const STL_RE = /\.stl$/i;

/** `derived_files` filtered to `.glb` first, then `.stl`; other extensions dropped; order within each group kept. */
export function diffCandidates(derivedFiles: readonly string[]): string[] {
  return [...derivedFiles.filter((f) => GLB_RE.test(f)), ...derivedFiles.filter((f) => STL_RE.test(f))];
}

/** Pure: never mutates `model` or `staleness`. */
export function buildDiffPlan(model: ProjectModel, staleness: StalenessReport): DiffPlan {
  const jobs = new Map<string, DiffJob>();
  for (const mediaId of Object.keys(staleness).sort()) {
    const entry = staleness[mediaId]!;
    if (entry.status !== 'STALE') continue;
    for (const hero of entry.stale_heroes) {
      const key = `${hero.component}@${hero.shot_with}`;
      const existing = jobs.get(key);
      if (existing) {
        if (!existing.media.includes(mediaId)) existing.media.push(mediaId);
        continue;
      }
      const component = model.components.get(hero.component);
      jobs.set(key, {
        key,
        component: hero.component,
        version: hero.shot_with,
        current: hero.current,
        component_file: `docs/components/${hero.component}.yaml`,
        candidates: diffCandidates(component?.derived_files ?? []),
        output: `${OLD_RENDER_OUTPUT_DIR}/${key}.glb`,
        media: [mediaId],
      });
    }
  }
  const sorted = [...jobs.values()].sort((a, b) => cmp(a.key, b.key));
  for (const job of sorted) job.media.sort();
  return { version: DIFF_PLAN_VERSION, jobs: sorted };
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
