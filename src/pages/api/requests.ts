import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseClient(cookies, request);

  try {
    const data = await request.json();
    const { email, idea_description } = data;

    if (!idea_description || typeof idea_description !== 'string' || idea_description.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Tool description is required' }), { status: 400 });
    }

    const { error } = await supabase
      .from('tool_requests')
      .insert([{ 
        email: email || null, 
        idea_description: idea_description.trim() 
      }]);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Tool request submission error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit tool request' }), { status: 500 });
  }
};
