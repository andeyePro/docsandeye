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
  CheckSchema,
  ComponentReceiptSchema,
  ComponentSchema,
  ContactSchema,
  ConfigSchema,
  DEFAULT_DENYLIST,
  GuideSchema,
  KEBAB_ID_RE,
  MASTER_FORMATS,
  MEDIA_TYPES,
  MediaSchema,
  PART_CATEGORIES,
  PIN_RE,
  ProfileItemSchema,
  ProjectMetaSchema,
  RECEIPT_PER,
  ReceiptConfigSchema,
  RELEASE_SEMVER_RE,
  RENDER_FORMATS,
  RENDER_VIEWS,
  RenderSchema,
  StepFrontmatterSchema,
  SupplierSchema,
  ViewerSchema,
  WhenSchema,
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
  ComponentReceipt,
  Config,
  ContactConfig,
  Frontmatter,
  Guide,
  MasterFormat,
  Media,
  MediaType,
  ParameterValue,
  ParseConfigOptions,
  PartCategory,
  Pin,
  ProjectMeta,
  RenderFormat,
  RenderView,
  Step,
  StepFrontmatter,
  StepCheck,
  StepPart,
  StepRender,
  StepViewer,
  Supplier,
} from './schemas.js';

export {
  MAILTO_MAX_LENGTH,
  PROFILE_TYPES,
  STORAGE_KEYS,
  YOUTUBE_ID_RE,
  checkMailto,
  checksComplete,
  computeReceipt,
  defaultProfile,
  describeWhen,
  escapeHtml,
  formatDuration,
  matchesWhen,
  missingParts,
  missingPartsMailto,
  nextApplicableStep,
  normaliseProfile,
  parseComparator,
  parseStoredProfile,
  parseWhenComment,
  profileSummary,
  validateWhen,
  whenLabel,
  wrapWhenBlocks,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from './interactive.js';
export type {
  CheckAnswer,
  CheckMailtoInput,
  CheckRef,
  Contact,
  MissingMailtoInput,
  MissingPart,
  Profile,
  ProfileItem,
  ProfileOption,
  ProfileType,
  ProfileValue,
  Receipt,
  ReceiptConfig,
  ReceiptItem,
  ReceiptRow,
  StepRef,
  When,
  WhenBlockProblem,
  WhenScalar,
} from './interactive.js';

export { buildReceipt, receiptItems } from './receipt.js';

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

export { DIFF_PLAN_VERSION, OLD_RENDER_OUTPUT_DIR, buildDiffPlan, diffCandidates } from './diff-plan.js';
export type { DiffJob, DiffPlan } from './diff-plan.js';

export {
  EXPORT_OUTPUT_DIR,
  EXPORT_PLAN_VERSION,
  buildExportPlan,
  buildUpLink,
  emitYaml,
  substituteBuildUpLinks,
} from './export-plan.js';
export type { BuildUpRef, BuildUpSubstitution, ExportAsset, ExportFile, ExportPlan, YamlMapping, YamlScalar, YamlValue } from './export-plan.js';

export { checkVersionBumps } from './guard.js';
export type { VersionBumpFacts, VersionBumpResult, Violation } from './guard.js';
