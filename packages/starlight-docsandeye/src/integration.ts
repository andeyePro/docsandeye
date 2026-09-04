/**
 * The Astro integration behind the Starlight plugin: one prerendered route
 * per guide index and per step, the maintainer-only `/reshoot` route, the
 * virtual data module, a dev-server handler for `/_docsandeye/*`, and the
 * static copy step after the build.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { collectStaticAssets, copyStaticAssets } from './assets.ts';
import type { DocsandeyeData } from './data.ts';
import { guidePattern } from './view.ts';
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

export function createDocsandeyeIntegration({ data, projectRoot }: DocsandeyeIntegrationOptions): AstroIntegration {
  const assets = collectStaticAssets(data, projectRoot);
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
