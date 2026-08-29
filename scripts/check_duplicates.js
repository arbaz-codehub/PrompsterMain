import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('prompts').select('id, slug, title');
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Total prompts: ${data.length}`);
  
  const slugCounts = {};
  for (const item of data) {
    slugCounts[item.slug] = (slugCounts[item.slug] || 0) + 1;
  }
  
  const duplicates = Object.entries(slugCounts).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('Found duplicate slugs:');
    for (const [slug, count] of duplicates) {
      console.log(`- ${slug}: ${count} copies`);
    }
    
    console.log('\nExample IDs for duplicate slugs:');
    for (const [slug] of duplicates) {
      const ids = data.filter(d => d.slug === slug).map(d => d.id);
      console.log(`- ${slug}: ${ids.join(', ')}`);
    }
  } else {
    console.log('No duplicate slugs found in the database!');
  }
}
check();
