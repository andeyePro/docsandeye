/**
 * Version-bump guard: a pure check that a component whose source files changed
 * also had its `design_version` bumped. The caller supplies the git facts;
 * this module never runs git.
 */
import type { ProjectModel } from './load.js';

export interface VersionBumpFacts {
  /** Commit that last touched any of the component's `source_files`. */
  sourceCommit: string;
  /** Commit that last changed the component's `design_version`. */
  versionCommit: string;
}

export interface Violation {
  component: string;
  designVersion: string;
  sourceCommit: string;
  versionCommit: string;
  message: string;
}

export interface VersionBumpResult {
  violations: Violation[];
  /** Components with source files but no facts supplied, sorted. */
  unchecked: string[];
}

export function checkVersionBumps(model: ProjectModel, facts: Record<string, VersionBumpFacts>): VersionBumpResult {
  const violations: Violation[] = [];
  const unchecked: string[] = [];
  const ids = [...model.components.keys()].sort();
  for (const id of ids) {
    const component = model.components.get(id)!;
    if (component.source_files.length === 0) continue;
    const fact = facts[id];
    if (!fact) {
      unchecked.push(id);
      continue;
    }
    if (fact.sourceCommit !== fact.versionCommit) {
      violations.push({
        component: id,
        designVersion: component.design_version,
        sourceCommit: fact.sourceCommit,
        versionCommit: fact.versionCommit,
        message: `${id}: source files last changed in ${fact.sourceCommit} but design_version ${component.design_version} was last bumped in ${fact.versionCommit}`,
      });
    }
  }
  return { violations, unchecked: unchecked.sort() };
}
