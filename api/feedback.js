// api/feedback.js — returns live AI pipeline feedback for the dashboard
import { supabase } from './lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data, error } = await supabase
      .from('ai_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('ai_feedback fetch error:', error);
      return res.status(500).json({ error: error.message, data: [] });
    }

    return res.status(200).json({ data: data ?? [], count: data?.length ?? 0 });
  } catch (err) {
    console.error('feedback handler crash:', err);
    return res.status(500).json({ error: err.message, data: [] });
  }
}
