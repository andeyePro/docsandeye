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
  CHECK_OPTIONS_MAX,
  CHECK_OPTIONS_MIN,
  CheckSchema,
  ComponentReceiptSchema,
  ComponentSchema,
  ContactSchema,
  ConfigSchema,
  DEFAULT_DENYLIST,
  GLOSSARY_TIP_MAX,
  GlossaryEntrySchema,
  GlossarySchema,
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
  parseGlossary,
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
  StepCheckOption,
  StepPart,
  StepRender,
  StepViewer,
  Supplier,
} from './schemas.js';

export {
  CONSENT_KEY,
  CONSENT_NOTICE_HIDDEN_KEY,
  MAILTO_MAX_LENGTH,
  PROFILE_TYPES,
  STORAGE_KEYS,
  YOUTUBE_ID_RE,
  answerKey,
  checkMailto,
  checkedKeys,
  checkoffKey,
  checksComplete,
  choosableOptions,
  computeReceipt,
  consentView,
  defaultProfile,
  effectiveProfile,
  describeWhen,
  escapeHtml,
  fnv1aHex,
  formatCount,
  formatDuration,
  impliedItems,
  impliesProblems,
  isSafeHref,
  itemsForGuide,
  labelParts,
  matchesWhen,
  missingParts,
  missingPartsMailto,
  nextApplicableStep,
  normaliseProfile,
  optionAnswer,
  optionToken,
  parseComparator,
  parseConsent,
  parseStoredProfile,
  parseWhenComment,
  plainLabel,
  profileSummary,
  setCheckoff,
  validateWhen,
  whenLabel,
  wrapWhenBlocks,
  wrongPick,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from './interactive.js';
export type {
  CheckAnswer,
  CheckMailtoInput,
  CheckRef,
  ConsentState,
  Contact,
  LabelPart,
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

export { compileGlossary, inlineCodeHtml, inlineMarkdownHtml, linkGlossaryTerms, termButton, termIds, unusedGlossaryEntries } from './glossary.js';
export type { CompiledGlossaryEntry, GlossaryEntry, TermIds } from './glossary.js';

export {
  DEFAULT_BRANCH,
  isRelativeLink,
  linkTarget,
  markdownLinks,
  repoBlobUrl,
  resolveRelativeLink,
  stepFilePath,
  unresolvedLinkMessage,
} from './links.js';
export type { LinkContext, LinkTarget } from './links.js';

export { buildReceipt, isDraftNote, readerNote, receiptItems, type ReceiptItemsOptions } from './receipt.js';

export { COLLECTION_DIRS, GLOSSARY_FILE, isDenylisted, loadProject, stepsForGuide } from './load.js';
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

export { correctPosition, guideOffset, localCheckImages, placeCheckOptions, placeCorrectOption, yesNoCheckWarnings } from './checks.js';

export { mentionPattern, mentionsComponent, unmentionedComponents } from './mentions.js';
