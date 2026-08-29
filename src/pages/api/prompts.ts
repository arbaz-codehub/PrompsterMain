import type { APIRoute } from 'astro';
import { getPaginatedPrompts } from '../../lib/prompts';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '12');
  
  let category: string | string[] | undefined = url.searchParams.get('category') || undefined;
  const feed = url.searchParams.get('feed') || undefined;
  const preferencesStr = url.searchParams.get('preferences');

  if (feed === 'personalized' && preferencesStr) {
    category = preferencesStr.split(',').map(s => s.trim());
  }

  const result = await getPaginatedPrompts(page, limit, category);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
};
