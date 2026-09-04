/**
 * `stepFrontmatterExtension`: the variant handed to `docsSchema({ extend })`.
 *
 * The `docs` collection holds ordinary documentation pages as well as the
 * step pages the plugin generates, so the extension must accept a page that
 * carries none of the step fields — while `stepFrontmatterSchema` itself stays
 * strict for anything that really is a step.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFrontmatter } from '@docsandeye/core';
import { stepFrontmatterExtension, stepFrontmatterSchema } from '../schema.ts';

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const PROJECT_DIR = path.join(PKG_ROOT, 'fixtures/project');

const PLAIN_DOC = { title: 'x' };

describe('stepFrontmatterExtension', () => {
  it('accepts a plain documentation page that the strict schema rejects', () => {
    expect(stepFrontmatterExtension.safeParse(PLAIN_DOC).success).toBe(true);
    expect(stepFrontmatterSchema.safeParse(PLAIN_DOC).success).toBe(false);
  });

  it('keeps core\'s list defaults and adds nothing else', () => {
    const parsed = stepFrontmatterExtension.parse(PLAIN_DOC);
    expect(parsed).toEqual({ title: 'x', parts: [], tools: [], renders: [] });
  });

  it('makes every field of the strict schema optional', () => {
    expect(Object.keys(stepFrontmatterExtension.shape).sort()).toEqual(Object.keys(stepFrontmatterSchema.shape).sort());
    expect(stepFrontmatterExtension.safeParse({}).success).toBe(true);
  });

  it('still validates the fields a page does declare', () => {
    expect(stepFrontmatterExtension.safeParse({ title: 'x', order: 'first' }).success).toBe(false);
    expect(stepFrontmatterExtension.safeParse({ title: 'x', parts: [{ component: 'widget', cat: 'nonsense' }] }).success).toBe(false);
  });

  it('accepts the frontmatter of a real step', () => {
    const text = readFileSync(path.join(PROJECT_DIR, 'docs/steps/step-01-raft.md'), 'utf8');
    const { data } = readFrontmatter(text, 'step-01-raft.md');
    expect(stepFrontmatterSchema.safeParse(data).success).toBe(true);
    expect(stepFrontmatterExtension.safeParse(data).success).toBe(true);
  });
});
