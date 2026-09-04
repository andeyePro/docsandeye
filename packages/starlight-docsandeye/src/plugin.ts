/**
 * The Starlight plugin. Its `config:setup` hook loads the project, wires the
 * theme pack and component overrides into the Starlight config, and adds the
 * Astro integration that owns routes, the virtual module and the copy step.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HookParameters, StarlightPlugin } from '@astrojs/starlight/types';
import { loadDocsandeyeData } from './data.ts';
import { createDocsandeyeIntegration } from './integration.ts';
import { resolveThemeCss } from './theme.ts';

export const PLUGIN_NAME = 'starlight-docsandeye';
export const DOCSANDEYE_CSS = 'starlight-docsandeye/src/styles/docsandeye.css';

/** Component overrides the plugin needs; the user's own overrides win on conflict. */
export const PLUGIN_COMPONENTS = {
  Head: 'starlight-docsandeye/src/components/Head.astro',
  Sidebar: 'starlight-docsandeye/src/components/Sidebar.astro',
  PageTitle: 'starlight-docsandeye/src/components/PageTitle.astro',
} as const;

export interface DocsandeyeOptions {
  /** Docs&I project root (holds `docsandeye.config.yaml`); relative paths resolve against the Astro project root. Default: the Astro project root. */
  projectRoot?: string;
}

type ConfigSetupParams = HookParameters<'config:setup'>;

function astroRootOf(params: Partial<ConfigSetupParams>): string {
  const root: unknown = params.astroConfig?.root;
  if (root instanceof URL) return fileURLToPath(root);
  if (typeof root === 'string') return root.startsWith('file:') ? fileURLToPath(root) : root;
  return process.cwd();
}

export default function docsandeye(options: DocsandeyeOptions = {}): StarlightPlugin {
  return {
    name: PLUGIN_NAME,
    hooks: {
      'config:setup'(params) {
        const { config, updateConfig, addIntegration, logger } = params;
        const astroRoot = astroRootOf(params);
        const projectRoot = path.resolve(astroRoot, options.projectRoot ?? '.');

        const data = loadDocsandeyeData(projectRoot, process.env);
        const themeCss = resolveThemeCss(data.config.theme, astroRoot);

        updateConfig({
          customCss: [...(config.customCss ?? []), DOCSANDEYE_CSS, themeCss],
          components: { ...PLUGIN_COMPONENTS, ...(config.components ?? {}) },
        });

        addIntegration?.(createDocsandeyeIntegration({ data, projectRoot }));

        logger?.info?.(
          `${data.config.guides.length} guide(s), ${data.model.steps.size} step(s), theme "${data.config.theme}"` +
            `${data.maintainer ? ', maintainer build' : ''}, build date ${data.buildDate}`,
        );
      },
    },
  };
}
