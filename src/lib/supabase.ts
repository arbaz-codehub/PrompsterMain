import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const createSupabaseClient = (cookies: AstroCookies, request?: Request) => {
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          if (request) {
            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
              return parseCookieHeader(cookieHeader);
            }
          }
          const all = [];
          try {
            for (const cookie of (cookies as any)) {
              if (Array.isArray(cookie)) {
                all.push({ name: cookie[0], value: cookie[1].value });
              }
            }
          } catch (e) {}
          return all;
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              console.log(`[Supabase Cookies] Setting cookie: ${name}`);
              cookies.set(name, value, {
                ...options,
                path: '/',
                secure: import.meta.env.PROD,
                sameSite: 'lax',
                maxAge: (options.maxAge !== undefined && options.maxAge <= 0) ? options.maxAge : 31536000 // Allow deletion, otherwise 1 year
              });
            });
          } catch (error) {
            console.error(`[Supabase Cookies] Error setting cookies:`, error);
          }
        },
      },
    }
  );
};
