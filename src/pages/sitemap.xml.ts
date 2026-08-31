import type { APIRoute } from 'astro';
import { getPrompts } from '../lib/prompts';

export const GET: APIRoute = async () => {
  const siteUrl = import.meta.env.SITE_URL || 'https://prompster.shop';
  const prompts = await getPrompts();

  const urls = [
    { loc: siteUrl, changefreq: 'daily', priority: '1.0' },
    ...prompts.map((p) => ({
      loc: `${siteUrl}/prompt/${p.slug}`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: p.updatedAt.split('T')[0],
      images: p.images,
    })),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
      .map(
        (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
    ${'lastmod' in u ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    ${'images' in u && Array.isArray(u.images) ? u.images.map(img => `<image:image><image:loc>${img}</image:loc></image:image>`).join('\n    ') : ''}
  </url>`
      )
      .join('\n')}
</urlset>`;

  return new Response(sitemap.trim(), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
