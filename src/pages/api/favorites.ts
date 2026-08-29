import type { APIRoute } from 'astro';
import { createSupabaseClient } from '../../lib/supabase';
import { getPrompts } from '../../lib/prompts';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseClient(cookies, request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('favorites')
    .eq('id', user.id)
    .single();

  const favoriteIds = profile?.favorites || [];

  const url = new URL(request.url);
  const expand = url.searchParams.get('expand') === 'true';

  if (!expand) {
    // Just return the IDs
    return new Response(JSON.stringify({ ids: favoriteIds }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Return full prompt objects
  const allPrompts = await getPrompts();
  const favoritePrompts = allPrompts.filter(prompt => favoriteIds.includes(prompt.id));
  
  // Sort to match order of favoriteIds (most recently favorited first, assuming push)
  favoritePrompts.sort((a, b) => favoriteIds.indexOf(a.id) - favoriteIds.indexOf(b.id));

  return new Response(JSON.stringify(favoritePrompts), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseClient(cookies, request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { promptId } = body;

    if (!promptId) {
      return new Response(JSON.stringify({ error: 'promptId is required' }), { status: 400 });
    }

    // 1. Get current favorites
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('favorites')
      .eq('id', user.id)
      .single();

    let currentFavorites = profile?.favorites || [];

    // 2. Toggle the ID
    const index = currentFavorites.indexOf(promptId);
    if (index > -1) {
      // Remove
      currentFavorites.splice(index, 1);
    } else {
      // Add
      currentFavorites.push(promptId);
    }

    // 3. Save back to DB
    const { error } = await supabase
      .from('user_profiles')
      .update({ favorites: currentFavorites })
      .eq('id', user.id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, ids: currentFavorites }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Favorites toggle error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update favorites' }), { status: 500 });
  }
};
