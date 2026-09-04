/**
 * Frontmatter schema for a Docs&I step, for use with Starlight's
 * `docsSchema({ extend: stepFrontmatterSchema })`.
 *
 * This is core's step frontmatter shape verbatim: `id`, `order`, `title`,
 * `guide`, `branch`, `parts`, `tools`, `renders` (unique ids), `viewer`,
 * `media`, `safety`. The id-vs-filename check performed by core's `parseStep`
 * needs the filename and so is deliberately NOT part of this schema.
 */
import { StepFrontmatterSchema } from '@docsandeye/core';

export const stepFrontmatterSchema = StepFrontmatterSchema;
export type { StepFrontmatter } from '@docsandeye/core';
