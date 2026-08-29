import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Protect admin routes (except login page and auth API)
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isLoginPage = pathname === '/admin/login';
  const isAuthApi = pathname === '/api/admin/auth';
  const isAnalyticsTrack = pathname === '/api/analytics/track';

  if (isAdminRoute && !isLoginPage && !isAuthApi) {
    const authToken = context.cookies.get('prompster_admin')?.value;

    if (authToken !== 'authenticated') {
      // For API routes, return 401
      if (pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // For pages, redirect to login
      return context.redirect('/admin/login');
    }
  }

  return next();
});
