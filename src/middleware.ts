import { defineMiddleware } from 'astro:middleware';
import { createSupabaseClient } from './lib/supabase';

const routeCache = new Map<string, { html: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
// Dev server cache bust 3

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  const path = url.pathname;
  const isGet = context.request.method === 'GET';
  
  // Clear cache aggressively on any mutation (POST, PUT, DELETE)
  if (!isGet) {
    routeCache.clear();
  }

  // 0. Fallback for Supabase Redirect URL misconfigurations
  // If Supabase rejects the custom redirectTo (e.g. missing 'www' in dashboard),
  // it defaults to the Site URL and appends the code to the homepage.
  // We intercept it here and forward it to our actual callback handler!
  if (path === '/' && url.searchParams.has('code')) {
    return context.redirect(`/api/auth/callback?${url.searchParams.toString()}`);
  }

  const isApiOrAction = path.startsWith('/api/') || path.startsWith('/login') || path.startsWith('/signup');
  const isDynamicPrompt = path.startsWith('/prompt/');

  const supabase = createSupabaseClient(context.cookies, context.request);

  // 1. Fast local cookie check to determine user ID without network request
  // Using a custom cookie avoids Supabase's getSession() warning in the console
  const userId = context.cookies.get('prompster_user_id')?.value || 'anon';

  // 2. Check cache for standard GET pages
  const cacheKey = `${path}${url.search}-${userId}`;
  
  if (isGet && !isApiOrAction && !isDynamicPrompt) {
    const cached = routeCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      return new Response(cached.html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // 3. Fast Auth Bypass for Login/Signup
  // If guest visits auth pages, instantly load without waiting for Supabase
  if ((path === '/login' || path === '/signup') && userId === 'anon') {
    context.locals.user = null;
    return next();
  }

  // 4. Cache Miss: Proceed normally. Call getUser to securely validate the token with Supabase
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect authenticated users away from auth pages
  if ((path === '/login' || path === '/signup') && user) {
    return context.redirect('/');
  }

  // Keep our fast cache cookie in sync with the secure user object
  if (user) {
    context.cookies.set('prompster_user_id', user.id, { path: '/', secure: import.meta.env.PROD, sameSite: 'lax', maxAge: 31536000 });
  } else {
    context.cookies.delete('prompster_user_id', { path: '/' });
  }

  // ── Protect onboarding ──
  if (path.startsWith('/onboarding') && !user) {
    return context.redirect('/login');
  }

  context.locals.user = user;
  const isExemptRoute = path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/onboarding') || path.startsWith('/api/');

  if (user && !isExemptRoute) {
    const hasPreferences = context.cookies.get('has_preferences')?.value === 'true';
    const skippedOnboarding = context.cookies.get('skip_onboarding')?.value === 'true';

    if (!hasPreferences && !skippedOnboarding) {
      try {
        const { data: profile } = await supabase.from('user_profiles').select('preferences').eq('id', user.id).single();
        if (!profile || !profile.preferences || profile.preferences.length === 0) {
          return context.redirect('/onboarding');
        } else {
          context.cookies.set('has_preferences', 'true', { path: '/' });
        }
      } catch {}
    }
  }

  const response = await next();

  // 4. Save successful HTML responses to cache
  if (isGet && !isApiOrAction && !isDynamicPrompt && response.status === 200) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const clonedResponse = response.clone();
      const html = await clonedResponse.text();
      routeCache.set(cacheKey, { html, timestamp: Date.now() });
    }
  }

  return response;
});
