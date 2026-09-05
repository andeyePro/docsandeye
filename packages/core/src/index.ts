/**
 * @docsandeye/core — the contract every other Docs&I package compiles against.
 */
export { PROBLEM_CODES, DocsiError, compareProblems, sortProblems } from './errors.js';
export type { Problem, ProblemCode } from './errors.js';

export { canonicalJson } from './canonical-json.js';
export type { CanonicalJsonOptions } from './canonical-json.js';

export {
  BUILTIN_HOSTING_PROVIDERS,
  createHostingRegistry,
  defaultHostingRegistry,
  localProvider,
  r2Provider,
  registerHostingProvider,
  resetHostingRegistry,
  resolveMediaUrl,
  urlPrefixProvider,
} from './hosting.js';
export type { HostingConfig, HostingProvider, HostingRegistry } from './hosting.js';

export {
  CONFIG_FILENAME,
  COMPONENT_KINDS,
  ChangelogEntrySchema,
  ComponentSchema,
  ConfigSchema,
  DEFAULT_DENYLIST,
  GuideSchema,
  KEBAB_ID_RE,
  MASTER_FORMATS,
  MEDIA_TYPES,
  MediaSchema,
  PART_CATEGORIES,
  PIN_RE,
  RELEASE_SEMVER_RE,
  RENDER_FORMATS,
  RENDER_VIEWS,
  RenderSchema,
  StepFrontmatterSchema,
  SupplierSchema,
  ViewerSchema,
  isReleaseSemver,
  mergeDenylist,
  parseComponent,
  parseConfig,
  parseMedia,
  parsePin,
  parseStep,
  parseYamlDocument,
  readFrontmatter,
} from './schemas.js';
export type {
  ChangelogEntry,
  Component,
  ComponentKind,
  Config,
  Frontmatter,
  Guide,
  MasterFormat,
  Media,
  MediaType,
  ParameterValue,
  ParseConfigOptions,
  PartCategory,
  Pin,
  RenderFormat,
  RenderView,
  Step,
  StepFrontmatter,
  StepPart,
  StepRender,
  StepViewer,
  Supplier,
} from './schemas.js';

export { COLLECTION_DIRS, isDenylisted, loadProject, stepsForGuide } from './load.js';
export type { LoadProjectOptions, ProjectModel } from './load.js';

export { changelogBetween, computeStaleness } from './staleness.js';
export type { StalePin, StalenessEntry, StalenessReport, StalenessStatus } from './staleness.js';

export { buildReshootIndex } from './reshoot.js';
export type { Appearance, AppearanceRole, ReshootEntry } from './reshoot.js';

export { RENDER_OUTPUT_DIR, RENDER_PLAN_VERSION, buildRenderPlan, renderJobKey, renderParamsHash } from './render-plan.js';
export type { RenderJob, RenderJobOptions, RenderPlan } from './render-plan.js';

export { MEDIA_OUTPUT_DIR, MEDIA_PLAN_VERSION, MEDIA_RENDITIONS, buildMediaPlan } from './media-plan.js';
export type { MediaJob, MediaJobOutputs, MediaPlan } from './media-plan.js';

export { checkVersionBumps } from './guard.js';
export type { VersionBumpFacts, VersionBumpResult, Violation } from './guard.js';
