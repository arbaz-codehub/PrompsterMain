import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const siteUrl = import.meta.env.SITE_URL || 'https://prompster.art';

  const robotsTxt = `
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`.trim();

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
