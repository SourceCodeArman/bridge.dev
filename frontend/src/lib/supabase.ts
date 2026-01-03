import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function listAllIcons() {
  const { data, error } = await supabase
    .storage
    .from('connector-logos')
    .list('', {
      limit: 100,      // max per page (default 100)
      offset: 0,       // start at first
      sortBy: { column: 'name', order: 'asc' }
    })

  if (error) throw error
  return data   // array of files/folders in root
}
