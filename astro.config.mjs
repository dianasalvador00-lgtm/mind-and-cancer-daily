import { defineConfig } from 'astro/config';

// GitHub Pages project site: https://dianasalvador00-lgtm.github.io/mind-and-cancer-daily/
export default defineConfig({
  site: 'https://dianasalvador00-lgtm.github.io',
  base: '/mind-and-cancer-daily/',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
