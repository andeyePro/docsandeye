// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import docsandeye from 'starlight-docsandeye';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: "{{title}}",
      plugins: [docsandeye()],
    }),
  ],
});
