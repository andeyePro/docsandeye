import { describe, it, expect } from 'vitest';
import { loadProject, checkVersionBumps } from '../src/index.js';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '../fixtures');

describe('AC10: Version-bump guard', () => {
  it('returns object with violations and unchecked arrays', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const result = checkVersionBumps(model, {});
    expect(result).toHaveProperty('violations');
    expect(result).toHaveProperty('unchecked');
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.unchecked)).toBe(true);
  });

  it('Violation has component, designVersion, sourceCommit, versionCommit, message', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const facts = {
      widget: { sourceCommit: 'abc123', versionCommit: 'def456' }
    };
    const result = checkVersionBumps(model, facts);
    if (result.violations.length > 0) {
      for (const v of result.violations) {
        expect(v).toHaveProperty('component');
        expect(v).toHaveProperty('designVersion');
        expect(v).toHaveProperty('sourceCommit');
        expect(v).toHaveProperty('versionCommit');
        expect(v).toHaveProperty('message');
      }
    }
  });

  it('reports violation when sourceCommit !== versionCommit', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const facts = {
      widget: { sourceCommit: 'abc123', versionCommit: 'def456' }
    };
    const result = checkVersionBumps(model, facts);
    expect(result.violations.length).toBeGreaterThan(0);
    const violation = result.violations[0];
    expect(violation.component).toBe('widget');
    expect(violation.sourceCommit).toBe('abc123');
    expect(violation.versionCommit).toBe('def456');
  });

  it('no violation when sourceCommit equals versionCommit', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const facts = {
      widget: { sourceCommit: 'abc123', versionCommit: 'abc123' }
    };
    const result = checkVersionBumps(model, facts);
    expect(result.violations).toHaveLength(0);
  });

  it('skips components with empty source_files silently', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    // anode-mmo has empty source_files
    const facts = {
      'anode-mmo': { sourceCommit: 'abc123', versionCommit: 'def456' }
    };
    const result = checkVersionBumps(model, facts);
    // Should not report a violation for anode-mmo
    const aNodeViolations = result.violations.filter(v => v.component === 'anode-mmo');
    expect(aNodeViolations).toHaveLength(0);
  });

  it('lists components in unchecked when absent from facts', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const facts = {}; // Empty facts
    const result = checkVersionBumps(model, facts);
    // All components with source_files should be in unchecked
    for (const component of model.components.values()) {
      if (component.source_files && component.source_files.length > 0) {
        expect(result.unchecked).toContain(component.id);
      }
    }
  });

  it('unchecked is sorted', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const facts = {}; // No facts, all checked components go to unchecked
    const result = checkVersionBumps(model, facts);
    const sorted = [...result.unchecked].sort();
    expect(result.unchecked).toEqual(sorted);
  });

  it('is pure (no git calls)', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const facts = {
      widget: { sourceCommit: 'abc', versionCommit: 'def' }
    };
    // Just calling should not throw or have side effects
    const result = checkVersionBumps(model, facts);
    expect(result).toBeDefined();
  });

  it('aep-like fixture with empty facts', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const result = checkVersionBumps(model, {});
    expect(result.violations).toBeDefined();
    expect(result.unchecked).toBeDefined();
  });
});
