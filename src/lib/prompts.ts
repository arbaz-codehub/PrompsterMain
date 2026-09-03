import type { Prompt, PaginatedResponse } from './types';
import { supabase } from './supabase';

// Simple in-memory cache for fast SSR navigation
const cache = {
  prompts: null as { data: Prompt[]; timestamp: number } | null,
  TTL: 60 * 60 * 1000 // 1 hour
};

export async function getPrompts(): Promise<Prompt[]> {
  const now = Date.now();
  if (cache.prompts && (now - cache.prompts.timestamp < cache.TTL)) {
    return cache.prompts.data;
  }

  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching prompts:', error);
    return [];
  }

  const mapped = data.map(mapDbToPrompt);
  cache.prompts = { data: mapped, timestamp: now };
  return mapped;
}

export async function getPromptBySlug(slug: string): Promise<Prompt | undefined> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return undefined;
  }

  return mapDbToPrompt(data);
}

export async function getPromptById(id: string): Promise<Prompt | undefined> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return undefined;
  }

  return mapDbToPrompt(data);
}

export async function getPromptsByCategory(category: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .ilike('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return data.map(mapDbToPrompt);
}

export async function getCategories(): Promise<string[]> {
  // Simplistic for now, should ideally be its own table or distinct query if supported
  const prompts = await getPrompts();
  return [...new Set(prompts.map((p) => p.category))].sort();
}

export async function getAllTags(): Promise<string[]> {
  const prompts = await getPrompts();
  return [...new Set(prompts.flatMap((p) => p.tags))].sort();
}

const paginatedCache: Record<string, { data: PaginatedResponse<Prompt>; timestamp: number }> = {};

export async function getPaginatedPrompts(
  page: number = 1,
  limit: number = 12,
  category?: string | string[]
): Promise<PaginatedResponse<Prompt>> {
  const cacheKey = `${page}-${limit}-${JSON.stringify(category || 'all')}`;
  const now = Date.now();
  if (paginatedCache[cacheKey] && (now - paginatedCache[cacheKey].timestamp < cache.TTL)) {
    return paginatedCache[cacheKey].data;
  }

  let query = supabase
    .from('prompts')
    .select('*', { count: 'exact' });

  if (category) {
    if (Array.isArray(category) && category.length > 0) {
      query = query.in('category', category);
    } else if (typeof category === 'string') {
      query = query.ilike('category', category);
    }
  }

  const start = (page - 1) * limit;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(start, start + limit - 1);

  if (error) {
    console.error('Error paginating prompts:', error);
    return { data: [], page, limit, total: 0, hasMore: false };
  }

  const total = count || 0;
  
  // Use the original sorted data without shuffling to keep ordering consistent across navigations
  const shuffledData = data.map(mapDbToPrompt);

  const result = {
    data: shuffledData,
    page,
    limit,
    total,
    hasMore: start + limit < total,
  };
  
  paginatedCache[cacheKey] = { data: result, timestamp: now };
  return result;
}

export async function addPrompt(data: Omit<Prompt, 'id' | 'slug' | 'createdAt' | 'updatedAt'>): Promise<Prompt | null> {
  const slug = generateSlug(data.title);
  
  const { data: insertedData, error } = await supabase
    .from('prompts')
    .insert([
      {
        slug,
        title: data.title,
        content: data.content,
        seo_description: data.seoDescription,
        prompts: data.prompts || [data.content],
        tags: data.tags,
        category: data.category,
        images: data.images,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding prompt:', error);
    return null;
  }

  clearPromptsCache();

  return mapDbToPrompt(insertedData);
}

export async function updatePrompt(
  id: string,
  data: Partial<Omit<Prompt, 'id' | 'createdAt'>>
): Promise<Prompt | null> {
  const updateData: any = { ...data };
  
  // Map camelCase to snake_case for Supabase
  if (data.seoDescription !== undefined) {
    updateData.seo_description = data.seoDescription;
    delete updateData.seoDescription;
  }
  if (data.updatedAt !== undefined) {
    delete updateData.updatedAt;
  }

  if (data.title) {
    updateData.slug = generateSlug(data.title);
  }
  
  updateData.updated_at = new Date().toISOString();

  const { data: updatedData, error } = await supabase
    .from('prompts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating prompt:', error);
    return null;
  }

  clearPromptsCache();

  return mapDbToPrompt(updatedData);
}

export async function deletePrompt(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('prompts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting prompt:', error);
    return false;
  }
  
  clearPromptsCache();
  
  return true;
}

export function clearPromptsCache() {
  cache.prompts = null;
  for (const key in paginatedCache) delete paginatedCache[key];
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const unsplashPlaceholders = [
  "https://images.unsplash.com/photo-1542038784456-1ea8e935640e",
  "https://images.unsplash.com/photo-1611162617474-5b21e879e113",
  "https://images.unsplash.com/photo-1455390582262-044cdead27d8",
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
  "https://images.unsplash.com/photo-1531685250784-afb3487c9413",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853",
  "https://images.unsplash.com/photo-1563089145-599997674d42",
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e",
  "https://images.unsplash.com/photo-1541701494587-cb58502866ab"
];

// Helper to convert snake_case DB format to camelCase Prompt type
function mapDbToPrompt(dbItem: any): Prompt {
  const mappedImages = (dbItem.images || []).map((img: string, index: number) => {
    if (img.includes('picsum.photos')) {
      const hash = (dbItem.id ? dbItem.id.charCodeAt(0) + dbItem.id.charCodeAt(dbItem.id.length - 1) : 0) + index;
      return unsplashPlaceholders[hash % unsplashPlaceholders.length];
    }
    return img;
  });

  return {
    id: dbItem.id,
    slug: dbItem.slug,
    title: dbItem.title,
    content: dbItem.content,
    seoDescription: dbItem.seo_description,
    prompts: dbItem.prompts,
    tags: dbItem.tags,
    category: dbItem.category,
    images: mappedImages,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
  };
}
