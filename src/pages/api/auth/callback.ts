import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createSupabaseClient(cookies, request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Auth Callback Error:', error.message);
      return redirect('/login?error=auth_failed');
    }
  }

  // Redirect to root, middleware will catch and redirect to onboarding if necessary
  return redirect('/');
};

