// api/lib/supabase.js  — shared Supabase client for all API routes
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service role key — has full DB access
);
