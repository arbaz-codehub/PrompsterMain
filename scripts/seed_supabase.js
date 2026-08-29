import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptsPath = path.resolve(__dirname, '../src/data/prompts.json');

async function seedDatabase() {
  console.log('Reading prompts.json...');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
  } catch (error) {
    console.error('Error reading prompts.json:', error.message);
    process.exit(1);
  }

  console.log(`Found ${data.length} prompts. Seeding to Supabase...`);

  for (const item of data) {
    const { error } = await supabase
      .from('prompts')
      .upsert({
        slug: item.slug,
        title: item.title,
        content: item.content,
        prompts: item.prompts || [item.content],
        tags: item.tags,
        category: item.category,
        images: item.images,
        created_at: item.createdAt,
        updated_at: item.updatedAt
      }, { onConflict: 'slug' });

    if (error) {
      console.error(`Error inserting ${item.slug}:`, error.message);
    } else {
      console.log(`✓ Inserted ${item.slug}`);
    }
  }

  console.log('Seeding complete!');
}

seedDatabase();
