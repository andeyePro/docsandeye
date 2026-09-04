/**
 * `virtual:docsandeye/model` — the build-time data handed to the Astro pages.
 * The module string is self-contained (no imports) so it can also be
 * evaluated directly from a data URL in tests.
 */
import type { DocsandeyeData } from './data.ts';

export const VIRTUAL_MODULE_ID = 'virtual:docsandeye/model';
const RESOLVED_ID = `\0${VIRTUAL_MODULE_ID}`;

/** The subset of Vite's `Plugin` shape this package produces (kept structural so `vite` is not a dependency). */
export interface DocsandeyeVitePlugin {
  name: string;
  resolveId(id: string): string | undefined;
  load(id: string): string | undefined;
}

function js(value: unknown): string {
  // JSON is valid JS apart from the two line terminators JSON allows unescaped.
  return JSON.stringify(value === undefined ? null : value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function mapLiteral(map: Map<string, unknown>): string {
  return `new Map(${js([...map.entries()])})`;
}

/** Serialise the data as an ES module exporting `config`, `model`, `staleness`, `renderManifest`, `carbon`, `buildDate`, `maintainer`. */
export function serialiseDocsandeyeData(data: DocsandeyeData): string {
  const { model } = data;
  return [
    `export const config = ${js(data.config)};`,
    `export const model = { config, components: ${mapLiteral(model.components)}, steps: ${mapLiteral(model.steps)}, media: ${mapLiteral(model.media)}, problems: ${js(model.problems)} };`,
    `export const staleness = ${js(data.staleness)};`,
    `export const renderManifest = ${js(data.renderManifest)};`,
    `export const carbon = ${js(data.carbon)};`,
    `export const buildDate = ${js(data.buildDate)};`,
    `export const maintainer = ${js(data.maintainer)};`,
    'export default { config, model, staleness, renderManifest, carbon, buildDate, maintainer };',
    '',
  ].join('\n');
}

export function createDocsandeyeVitePlugin(data: DocsandeyeData): DocsandeyeVitePlugin {
  return {
    name: 'starlight-docsandeye:model',
    resolveId(id) {
      return id === VIRTUAL_MODULE_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_ID ? serialiseDocsandeyeData(data) : undefined;
    },
  };
}
