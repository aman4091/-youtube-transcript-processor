import { createClient } from '@supabase/supabase-js';

// Get environment variables
// These should be added to .env.local and Vercel environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
// Note: Use anon key for client-side, service role key should only be used server-side
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We don't need auth sessions for now
  },
});

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Log configuration status (for debugging)
if (import.meta.env.DEV) {
  console.log('🔧 Supabase Configuration:', {
    url: supabaseUrl ? '✓ Set' : '✗ Missing',
    key: supabaseAnonKey ? '✓ Set' : '✗ Missing',
    configured: isSupabaseConfigured(),
  });
}
