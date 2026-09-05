// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';
import { themeHead } from '@docsandeye/themes/head.js';
import docsandeye from '../../index.ts';

// A site on a theme pack (../project-pioreactor sets `theme: pioreactor`), where
// the plugin — not this config — is expected to add the themes first-paint
// script to <head>. With DOCSANDEYE_FIXTURE_MANUAL_HEAD set, the config adds the
// script itself as an older site would, and the plugin must not add a second
// copy. No image service: the plugin copies renders and media verbatim (no sharp).
export default defineConfig({
	site: 'https://docsandeye.example',
	image: { service: passthroughImageService() },
	integrations: [
		starlight({
			title: 'Docs&I fixture',
			plugins: [docsandeye({ projectRoot: '../project-pioreactor' })],
			head: process.env.DOCSANDEYE_FIXTURE_MANUAL_HEAD ? themeHead() : [],
		}),
	],
});
