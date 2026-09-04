import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { stepFrontmatterSchema } from 'starlight-docsandeye/schema';

// This collection holds ordinary documentation pages as well as the step pages
// the plugin generates, and `docsSchema({ extend })` applies to every entry, so
// the step fields are made optional here. The plugin's schema carries a
// refinement (unique render ids) that zod will not `.partial()` directly; the
// same fields rebuilt from its shape can be.
const optionalStepFields = z.object(stepFrontmatterSchema.shape).partial();

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: optionalStepFields }) }),
};
