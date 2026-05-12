// api/lib/supabase.js  — shared Supabase client for all API routes
// NOTE: VITE_ prefixed vars are NOT available in Vercel serverless functions.
// We use SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY with VITE_ fallbacks.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL
                  || process.env.VITE_SUPABASE_URL
                  || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.VITE_SUPABASE_ANON_KEY
                  || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
