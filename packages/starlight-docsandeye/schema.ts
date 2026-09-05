/**
 * Frontmatter schemas for a Docs&I step, for use with Starlight's
 * `docsSchema({ extend: … })`.
 *
 * `stepFrontmatterSchema` is core's step frontmatter shape verbatim: `id`,
 * `order`, `title`, `guide`, `branch`, `parts`, `tools`, `renders` (unique
 * ids), `viewer`, `media`, `safety`. The id-vs-filename check performed by
 * core's `parseStep` needs the filename and so is deliberately NOT part of
 * this schema.
 *
 * `stepFrontmatterExtension` is the same shape with every step field optional.
 * It is the one to hand to `docsSchema({ extend })`, because that schema
 * applies to every entry in the `docs` collection — ordinary documentation
 * pages as well as the generated step pages — and an ordinary page has none
 * of the step fields.
 */
import { z } from 'zod';
import { StepFrontmatterSchema } from '@docsandeye/core';

export const stepFrontmatterSchema = StepFrontmatterSchema;
export type { StepFrontmatter } from '@docsandeye/core';

type Shape = Record<string, z.ZodType>;
type OptionalShape<S extends Shape> = { [K in keyof S]: z.ZodOptional<S[K]> };

/**
 * Every field of `shape` wrapped in `.optional()`.
 *
 * Zod 4 refuses `.partial()` on an object carrying a refinement (the step
 * schema checks render ids for uniqueness), so the optional variant is
 * rebuilt from the object's `.shape` instead. Rebuilding also drops the
 * refinement, which is the intended behaviour here: a page that declares no
 * `renders` has nothing to check.
 */
function optionalShape<S extends Shape>(shape: S): OptionalShape<S> {
  const out = {} as OptionalShape<S>;
  for (const key of Object.keys(shape) as (keyof S)[]) {
    out[key] = shape[key]!.optional() as OptionalShape<S>[typeof key];
  }
  return out;
}

/**
 * The step frontmatter fields, all optional, for
 * `docsSchema({ extend: stepFrontmatterExtension })`.
 */
export const stepFrontmatterExtension = z.object(optionalShape(StepFrontmatterSchema.shape));

export type StepFrontmatterExtension = z.output<typeof stepFrontmatterExtension>;
