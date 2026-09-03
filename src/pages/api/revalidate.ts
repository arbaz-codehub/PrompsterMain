import type { APIRoute } from 'astro';
import { clearPromptsCache } from '../../lib/prompts';

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  const secret = import.meta.env.WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;

  if (!secret) {
    return new Response(JSON.stringify({ error: 'Webhook secret not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (authHeader !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // If authorized, clear the in-memory cache
  clearPromptsCache();

  return new Response(JSON.stringify({ success: true, message: 'Cache cleared successfully' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
