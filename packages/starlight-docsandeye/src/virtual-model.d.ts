declare module 'virtual:docsandeye/model' {
  import type { Config, ProjectModel, StalenessReport } from '@docsandeye/core';
  import type { CarbonReport, RenderManifest } from './data.ts';
  export const config: Config;
  export const model: ProjectModel;
  export const staleness: StalenessReport;
  export const renderManifest: RenderManifest | null;
  export const carbon: CarbonReport | null;
  export const buildDate: string;
  export const maintainer: boolean;
}
