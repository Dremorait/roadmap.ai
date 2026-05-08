import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Accepts both legacy anon key (eyJ...) and new publishable key (sb_publishable_...)
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('[Supabase Debug] URL:', supabaseUrl);
console.log('[Supabase Debug] Key exists?', !!supabaseKey, supabaseKey?.substring(0, 15) + '...');

const isConfigured = supabaseUrl && supabaseKey && supabaseKey !== 'PASTE_YOUR_ANON_KEY_HERE';

if (!isConfigured) {
  console.warn('[Supabase] Not configured — running in offline/demo mode. Add VITE_SUPABASE_ANON_KEY to .env to enable auth & persistence.');
}

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createClient('https://placeholder.supabase.co', 'placeholder');

export const supabaseReady = isConfigured;
