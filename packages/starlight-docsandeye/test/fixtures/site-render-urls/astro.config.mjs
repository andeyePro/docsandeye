// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';
import docsandeye from '../../../index.ts';

// No image service: the plugin copies renders and media verbatim (no sharp).
export default defineConfig({
	site: 'https://docsandeye.example',
	image: { service: passthroughImageService() },
	integrations: [
		starlight({
			title: 'Docs&I render-url fixture',
			plugins: [docsandeye({ projectRoot: '../project-render-urls' })],
		}),
	],
});
