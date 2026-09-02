import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async (context) => {
  const supabase = createSupabaseClient(context.cookies, context.request);
  await supabase.auth.signOut();
  context.cookies.delete('prompster_user_id', { 
    path: '/',
    secure: import.meta.env.PROD,
    sameSite: 'lax'
  });
  return context.redirect('/');
};

