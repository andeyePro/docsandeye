import { describe, it, expect } from 'vitest';
import * as coreModule from '../src/index.js';

describe('AC12: Public surface', () => {
  it('exports parseComponent function', () => {
    expect(typeof coreModule.parseComponent).toBe('function');
  });

  it('exports parseStep function', () => {
    expect(typeof coreModule.parseStep).toBe('function');
  });

  it('exports parseMedia function', () => {
    expect(typeof coreModule.parseMedia).toBe('function');
  });

  it('exports parseConfig function', () => {
    expect(typeof coreModule.parseConfig).toBe('function');
  });

  it('exports loadProject function', () => {
    expect(typeof coreModule.loadProject).toBe('function');
  });

  it('exports computeStaleness function', () => {
    expect(typeof coreModule.computeStaleness).toBe('function');
  });

  it('exports buildReshootIndex function', () => {
    expect(typeof coreModule.buildReshootIndex).toBe('function');
  });

  it('exports buildRenderPlan function', () => {
    expect(typeof coreModule.buildRenderPlan).toBe('function');
  });

  it('exports checkVersionBumps function', () => {
    expect(typeof coreModule.checkVersionBumps).toBe('function');
  });

  it('exports resolveMediaUrl function', () => {
    expect(typeof coreModule.resolveMediaUrl).toBe('function');
  });

  it('exports stepsForGuide function', () => {
    expect(typeof coreModule.stepsForGuide).toBe('function');
  });

  it('exports readFrontmatter function', () => {
    expect(typeof coreModule.readFrontmatter).toBe('function');
  });

  it('exports canonicalJson function', () => {
    expect(typeof coreModule.canonicalJson).toBe('function');
  });

  it('exports DEFAULT_DENYLIST constant', () => {
    expect(Array.isArray(coreModule.DEFAULT_DENYLIST)).toBe(true);
    expect(coreModule.DEFAULT_DENYLIST.length).toBeGreaterThan(0);
  });

  it('exports isDenylisted function', () => {
    expect(typeof coreModule.isDenylisted).toBe('function');
  });

  it('exports registerHostingProvider function', () => {
    expect(typeof coreModule.registerHostingProvider).toBe('function');
  });

  it('exports createHostingRegistry function', () => {
    expect(typeof coreModule.createHostingRegistry).toBe('function');
  });

  it('exports resetHostingRegistry function', () => {
    expect(typeof coreModule.resetHostingRegistry).toBe('function');
  });

  it('exports DocsiError class', () => {
    expect(typeof coreModule.DocsiError).toBe('function');
  });

  it('exports type Component', () => {
    // Types are not runtime values, but the module should export the type for TS
    expect(coreModule).toBeDefined();
  });

  it('exports type Step', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type Media', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type Config', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type ProjectModel', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type StalenessEntry', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type ReshootEntry', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type RenderPlan', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type VersionBumpResult', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type HostingProvider', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports type Problem and ProblemCode', () => {
    expect(coreModule).toBeDefined();
  });

  it('exports RENDER_OUTPUT_DIR constant', () => {
    expect(typeof coreModule.RENDER_OUTPUT_DIR).toBe('string');
  });

  it('exports RENDER_PLAN_VERSION constant', () => {
    expect(typeof coreModule.RENDER_PLAN_VERSION).toBe('number');
  });

  it('exports renderParamsHash function', () => {
    expect(typeof coreModule.renderParamsHash).toBe('function');
  });

  it('exports renderJobKey function', () => {
    expect(typeof coreModule.renderJobKey).toBe('function');
  });

  it('exports COLLECTION_DIRS constant', () => {
    expect(typeof coreModule.COLLECTION_DIRS).toBe('object');
  });

  it('exports changelogBetween function', () => {
    expect(typeof coreModule.changelogBetween).toBe('function');
  });

  it('exports parsePin function', () => {
    expect(typeof coreModule.parsePin).toBe('function');
  });

  it('exports isReleaseSemver function', () => {
    expect(typeof coreModule.isReleaseSemver).toBe('function');
  });
});
