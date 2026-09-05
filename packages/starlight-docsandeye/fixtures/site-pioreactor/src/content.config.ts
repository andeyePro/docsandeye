import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { stepFrontmatterExtension } from '../../../schema.ts';

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: stepFrontmatterExtension }) }),
};
