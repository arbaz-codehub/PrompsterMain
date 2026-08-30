import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createSupabaseClient(cookies, request);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Auth Callback Error:', error.message);
      return redirect('/login?error=auth_failed');
    }
    
    // Set our fast cache cookie immediately so the first visit to / hits the logged-in cache!
    if (data?.user) {
      cookies.set('prompster_user_id', data.user.id, { path: '/', secure: import.meta.env.PROD, sameSite: 'lax', maxAge: 31536000 });
    }
  }

  // Redirect to root, middleware will catch and redirect to onboarding if necessary
  const res = redirect('/');
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
};

