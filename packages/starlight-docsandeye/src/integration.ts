/**
 * The Astro integration behind the Starlight plugin: one prerendered route
 * per guide index and per step, the maintainer-only `/reshoot` route, the
 * virtual data module, a dev-server handler for `/_docsandeye/*`, and the
 * static copy step after the build (render outputs, authored media, the
 * encode pipeline's media outputs and the old geometry restored by
 * `docsandeye diff`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { collectStaticAssets, copyStaticAssets, type StaticAsset } from './assets.ts';
import { OLD_RENDER_URL_PREFIX, SHOWN_OLD_STATUSES, type DocsandeyeData } from './data.ts';
import { MEDIA_URL_PREFIX, basename, guidePattern } from './view.ts';
import { createDocsandeyeVitePlugin } from './virtual.ts';

export interface DocsandeyeIntegrationOptions {
  data: DocsandeyeData;
  /** Absolute Docs&I project root. */
  projectRoot: string;
}

const ROUTES = {
  guide: 'starlight-docsandeye/src/routes/Guide.astro',
  step: 'starlight-docsandeye/src/routes/Step.astro',
  reshoot: 'starlight-docsandeye/src/routes/Reshoot.astro',
} as const;

const DEFINE_RE = /customElements\.define\(\s*[`'](docsi-[a-z-]+)[`']/g;

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.stl': 'model/stl',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt',
};

/**
 * Encoded media outputs (`build/media/manifest.json`) to copy under
 * `/_docsandeye/media/` for local hosting: every output path of every job that
 * exists on disk. A hosting provider serves them itself, so nothing is copied then.
 */
export function collectMediaOutputs(data: DocsandeyeData, projectRoot: string): StaticAsset[] {
  if (data.config.hosting.provider !== 'local' || !data.mediaManifest) return [];
  const root = path.resolve(projectRoot);
  const byUrl = new Map<string, StaticAsset>();
  for (const job of Object.values(data.mediaManifest.jobs)) {
    for (const rel of Object.values(job.outputs)) {
      const source = path.resolve(root, rel);
      if (!fs.existsSync(source)) continue;
      const url = `${MEDIA_URL_PREFIX}${basename(rel)}`;
      if (!byUrl.has(url)) byUrl.set(url, { url, source });
    }
  }
  return [...byUrl.values()];
}

/**
 * Old geometry (`build/render/old/manifest.json`) to copy under
 * `/_docsandeye/render/old/`: the output of every `restored|cached` job.
 */
export function collectOldGeometry(data: DocsandeyeData, projectRoot: string): StaticAsset[] {
  if (!data.oldGeometry) return [];
  const root = path.resolve(projectRoot);
  const byUrl = new Map<string, StaticAsset>();
  for (const key of Object.keys(data.oldGeometry.jobs).sort()) {
    const job = data.oldGeometry.jobs[key]!;
    if (!SHOWN_OLD_STATUSES.has(job.status)) continue;
    const url = `${OLD_RENDER_URL_PREFIX}${basename(job.output)}`;
    if (!byUrl.has(url)) byUrl.set(url, { url, source: path.resolve(root, job.output) });
  }
  return [...byUrl.values()];
}

/** Static assets plus media outputs and old geometry, de-duplicated by URL (first wins). */
function collectAllAssets(data: DocsandeyeData, projectRoot: string): StaticAsset[] {
  const byUrl = new Map<string, StaticAsset>();
  for (const asset of [...collectStaticAssets(data, projectRoot), ...collectMediaOutputs(data, projectRoot), ...collectOldGeometry(data, projectRoot)]) {
    if (!byUrl.has(asset.url)) byUrl.set(asset.url, asset);
  }
  return [...byUrl.values()];
}

export function createDocsandeyeIntegration({ data, projectRoot }: DocsandeyeIntegrationOptions): AstroIntegration {
  const assets = collectAllAssets(data, projectRoot);
  const assetByUrl = new Map(assets.map((a) => [a.url, a.source]));

  return {
    name: 'starlight-docsandeye',
    hooks: {
      'astro:config:setup'({ injectRoute, updateConfig }) {
        for (const guide of data.config.guides) {
          const pattern = guidePattern(guide);
          injectRoute({ pattern, entrypoint: ROUTES.guide, prerender: true });
          injectRoute({ pattern: `${pattern === '/' ? '' : pattern}/[step]`, entrypoint: ROUTES.step, prerender: true });
        }
        if (data.maintainer) {
          injectRoute({ pattern: '/reshoot', entrypoint: ROUTES.reshoot, prerender: true });
        }
        updateConfig({
          vite: {
            plugins: [
              {
                ...createDocsandeyeVitePlugin(data),
                // The minifier may re-quote string literals; keep the element registrations
                // in the canonical `customElements.define("docsi-…"` form the byte-budget
                // tooling greps for.
                generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
                  for (const output of Object.values(bundle)) {
                    if (output.type !== 'chunk' || !output.code || !output.code.includes('docsi-')) continue;
                    output.code = output.code.replace(DEFINE_RE, 'customElements.define("$1"');
                  }
                },
                // `astro dev`: serve the files the build would copy.
                configureServer(server: { middlewares: { use(handler: (req: any, res: any, next: () => void) => void): void } }) {
                  server.middlewares.use((req, res, next) => {
                    const url = (req.url ?? '').split('?')[0] ?? '';
                    const source = assetByUrl.get(decodeURIComponent(url));
                    if (!source || !fs.existsSync(source)) return next();
                    const ext = source.slice(source.lastIndexOf('.')).toLowerCase();
                    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
                    fs.createReadStream(source).pipe(res);
                  });
                },
              },
            ],
          },
        });
      },
      async 'astro:build:done'({ dir, logger }) {
        await copyStaticAssets(assets, fileURLToPath(dir), logger);
      },
    },
  };
}
