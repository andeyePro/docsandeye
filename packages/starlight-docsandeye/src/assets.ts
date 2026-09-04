/**
 * The static copy step. Render outputs listed in the render manifest and
 * locally hosted media files are copied verbatim into `dist/_docsandeye/`;
 * the page markup references them by those URLs. No image service, no
 * transformation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DocsandeyeData } from './data.ts';
import { MEDIA_URL_PREFIX, RENDER_URL_PREFIX, basename } from './view.ts';

export interface StaticAsset {
  /** Site-root-relative URL path, e.g. `/_docsandeye/render/<file>`. */
  url: string;
  /** Absolute source path under the project root. */
  source: string;
}

interface AssetLogger {
  info(message: string): void;
  warn(message: string): void;
}

/** Every file the build must copy, de-duplicated by URL (first source wins). */
export function collectStaticAssets(data: DocsandeyeData, projectRoot: string): StaticAsset[] {
  const root = path.resolve(projectRoot);
  const byUrl = new Map<string, StaticAsset>();
  const add = (prefix: string, rel: string) => {
    const url = `${prefix}${basename(rel)}`;
    if (!byUrl.has(url)) byUrl.set(url, { url, source: path.resolve(root, rel) });
  };
  for (const job of Object.values(data.renderManifest?.jobs ?? {})) {
    for (const output of job.outputs) add(RENDER_URL_PREFIX, output);
  }
  if (data.config.hosting.provider === 'local') {
    for (const media of data.model.media.values()) {
      add(MEDIA_URL_PREFIX, media.file);
      if (media.poster) add(MEDIA_URL_PREFIX, media.poster);
    }
  }
  return [...byUrl.values()];
}

/** Copy `assets` under `distDir`; missing sources are reported, never fatal. */
export async function copyStaticAssets(
  assets: StaticAsset[],
  distDir: string,
  logger: AssetLogger = console,
): Promise<{ copied: string[]; missing: string[] }> {
  const copied: string[] = [];
  const missing: string[] = [];
  for (const asset of assets) {
    const dest = path.join(distDir, ...asset.url.split('/').filter(Boolean));
    try {
      await fs.access(asset.source);
    } catch {
      missing.push(asset.source);
      continue;
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(asset.source, dest);
    copied.push(asset.url);
  }
  if (copied.length > 0) logger.info(`copied ${copied.length} render/media file(s) into _docsandeye/`);
  for (const source of missing) logger.warn(`missing render/media file, not copied: ${source}`);
  return { copied, missing };
}
