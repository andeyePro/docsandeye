// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';
import docsandeye from 'starlight-docsandeye';

// docs.andeye.com. The example guide comes from ../examples/synthetic-guide and
// is served under /example/ (its guide `base`). Renders and media are copied
// verbatim, so no image service is needed.
export default defineConfig({
	site: 'https://docs.andeye.com',
	image: { service: passthroughImageService() },
	integrations: [
		starlight({
			title: 'Docs&I',
			description: 'Interactive video documentation for open-source hardware that knows when its own videos have gone stale.',
			plugins: [docsandeye({ projectRoot: '../examples/synthetic-guide' })],
			components: { ThemeSelect: '@docsandeye/themes/ThemeSelect.astro' },
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/amy-bo/docsandeye' }],
			sidebar: [
				{ label: 'Start', items: [{ slug: 'getting-started' }] },
				{
					label: 'Authoring',
					items: [{ slug: 'authoring/components' }, { slug: 'authoring/steps' }, { slug: 'authoring/media' }],
				},
				{
					label: 'Reference',
					items: [{ slug: 'staleness' }, { slug: 'themes' }, { slug: 'carbon' }, { slug: 'cli' }, { slug: 'licence' }],
				},
				{ label: 'Example guide', items: [{ label: 'Bench lamp', link: '/example/' }] },
			],
		}),
	],
});
