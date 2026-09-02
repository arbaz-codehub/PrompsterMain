import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  site: 'https://www.prompster.shop',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'load'
  },
  vite: {
    css: {
      devSourcemap: true,
    },
  },
  image: {
    // Allows Astro's built-in <Image /> optimizer to process any HTTPS image from Supabase or other external sources
    remotePatterns: [{ protocol: 'https' }]
  },
});
