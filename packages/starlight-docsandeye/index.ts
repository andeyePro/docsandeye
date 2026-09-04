/**
 * starlight-docsandeye — the Starlight plugin that turns a Docs&I project
 * (validated by `@docsandeye/core`) into guide and step pages.
 */
export { default } from './src/plugin.ts';
export { default as docsandeye, DOCSANDEYE_CSS, PLUGIN_COMPONENTS, PLUGIN_NAME } from './src/plugin.ts';
export type { DocsandeyeOptions } from './src/plugin.ts';

export { createDocsandeyeIntegration } from './src/integration.ts';
export type { DocsandeyeIntegrationOptions } from './src/integration.ts';

export { VIRTUAL_MODULE_ID, createDocsandeyeVitePlugin, serialiseDocsandeyeData } from './src/virtual.ts';
export type { DocsandeyeVitePlugin } from './src/virtual.ts';

export { CARBON_PATH, RENDER_MANIFEST_PATH, loadDocsandeyeData } from './src/data.ts';
export type { CarbonPage, CarbonReport, DocsandeyeData, DocsandeyeEnv, RenderManifest, RenderManifestJob } from './src/data.ts';

export { STOCK_THEME, resolveThemeCss } from './src/theme.ts';
export { collectStaticAssets, copyStaticAssets } from './src/assets.ts';
export type { StaticAsset } from './src/assets.ts';

export { stepFrontmatterSchema } from './schema.ts';
export type { StepFrontmatter } from './schema.ts';
