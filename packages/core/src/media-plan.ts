/**
 * Media plan (`build/media-plan.json`) consumed by the Python encode pipeline.
 * One job per `type: video` manifest; photos need no encoding.
 *
 * The plan names every path the pipeline will touch — source, authored poster,
 * captions and the encoded outputs — so the Python side never has to know how
 * Docs&I lays out `build/`. Paths are POSIX and relative to the project root.
 */
import type { ProjectModel } from './load.js';
import type { Media } from './schemas.js';

export const MEDIA_PLAN_VERSION = 1 as const;
export const MEDIA_OUTPUT_DIR = 'build/media';
/** Every video is offered at these heights; the pipeline skips any taller than the source. */
export const MEDIA_RENDITIONS: readonly number[] = [720, 1080];

export interface MediaJobOutputs {
  av1_720: string;
  h264_720: string;
  av1_1080: string;
  h264_1080: string;
  poster: string;
  /** Present only when the manifest has captions. */
  captions?: string;
}

export interface MediaJob {
  key: string;
  media: string;
  source: string;
  poster_source: string;
  /** Present only when the manifest has captions. */
  captions?: string;
  duration_s: number;
  renditions: number[];
  outputs: MediaJobOutputs;
}

export interface MediaPlan {
  version: typeof MEDIA_PLAN_VERSION;
  project_root: string;
  jobs: MediaJob[];
}

export function buildMediaPlan(model: ProjectModel): MediaPlan {
  const jobs: MediaJob[] = [];
  for (const id of [...model.media.keys()].sort(compare)) {
    const media = model.media.get(id)!;
    if (media.type !== 'video') continue;
    jobs.push(mediaJob(media));
  }
  return { version: MEDIA_PLAN_VERSION, project_root: '.', jobs };
}

function mediaJob(media: Media): MediaJob {
  const key = media.id;
  // `poster` and `duration_s` are required for videos by MediaSchema.
  const job: MediaJob = {
    key,
    media: media.id,
    source: media.file,
    poster_source: media.poster!,
    duration_s: media.duration_s!,
    renditions: [...MEDIA_RENDITIONS],
    outputs: {
      av1_720: `${MEDIA_OUTPUT_DIR}/${key}-720.webm`,
      h264_720: `${MEDIA_OUTPUT_DIR}/${key}-720.mp4`,
      av1_1080: `${MEDIA_OUTPUT_DIR}/${key}-1080.webm`,
      h264_1080: `${MEDIA_OUTPUT_DIR}/${key}-1080.mp4`,
      poster: `${MEDIA_OUTPUT_DIR}/${key}.webp`,
    },
  };
  if (media.captions !== undefined) {
    job.captions = media.captions;
    job.outputs.captions = `${MEDIA_OUTPUT_DIR}/${basename(media.captions)}`;
  }
  return job;
}

/** Last POSIX path segment — the captions output keeps the authored language suffix. */
function basename(file: string): string {
  const parts = file.split('/');
  return parts[parts.length - 1] ?? file;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
