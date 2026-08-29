import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseClient(cookies, request);

  try {
    const data = await request.json();
    const { email } = data;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), { status: 400 });
    }

    const { error } = await supabase
      .from('waitlist_emails')
      .insert([{ email }]);

    if (error) {
      // Postgres error 23505 is unique violation (already on waitlist)
      if (error.code === '23505') {
        return new Response(JSON.stringify({ success: true, message: 'Already on the waitlist!' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Waitlist submission error:', error);
    return new Response(JSON.stringify({ error: 'Failed to join waitlist' }), { status: 500 });
  }
};
