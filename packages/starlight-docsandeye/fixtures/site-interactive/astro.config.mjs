// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';
import docsandeye from '../../index.ts';

// No image service: the plugin copies renders and media verbatim (no sharp).
export default defineConfig({
	site: 'https://docsandeye.example',
	image: { service: passthroughImageService() },
	integrations: [
		starlight({
			title: 'Docs&I interactive fixture',
			plugins: [docsandeye({ projectRoot: '../project-interactive' })],
			// The kit guide's entry is followed by its protocol page: the last step's "next".
			sidebar: [{ label: 'Kit', items: [{ label: 'Assembly', link: '/kit/' }, { slug: 'protocol' }] }],
		}),
	],
});
