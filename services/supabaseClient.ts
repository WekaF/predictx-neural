
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create client if URL is valid (starts with http/https) an NOT a placeholder
const isValidUrl = supabaseUrl && supabaseUrl.startsWith('http') && !supabaseUrl.includes('YOUR_SUPABASE_URL');
const isValidKey = supabaseAnonKey && !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY');

if (!isValidUrl || !isValidKey) {
  console.warn("Supabase credentials missing or invalid in .env.local. App will run in LOCAL ONLY mode.");
}

export const supabase = isValidUrl && isValidKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Disable navigator lock to prevent errors in some browser environments
        lock: false
      }
    }) 
  : null;
