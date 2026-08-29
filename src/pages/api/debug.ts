import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../lib/supabase';

export const GET: APIRoute = async (context) => {
  const supabase = createSupabaseClient(context.cookies, context.request);
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  return new Response(JSON.stringify({
    cookieHeader: context.request.headers.get('cookie'),
    sessionUser: session?.user?.id ?? null,
    getUser: user?.id ?? null,
  }), {
    headers: { 'content-type': 'application/json' }
  });
};
