import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { stepFrontmatterExtension } from 'starlight-docsandeye/schema';

// This collection holds ordinary documentation pages as well as the step pages
// the plugin generates, and `docsSchema({ extend })` applies to every entry, so
// the step fields must all be optional. The plugin exports exactly that shape
// as `stepFrontmatterExtension`; use it rather than rebuilding it here.
export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: stepFrontmatterExtension }) }),
};
