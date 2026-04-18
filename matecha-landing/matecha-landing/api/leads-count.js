import { createClient } from '@supabase/supabase-js';

// In-memory TTL cache — reused across warm serverless invocations
let cache = { value: 0, ts: 0 };
const TTL_MS = 60_000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const now = Date.now();
  if (now - cache.ts < TTL_MS) {
    return res.status(200).json({ count: cache.value, cached: true });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { count, error } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[leads-count] db error code:', error.code);
    return res.status(500).json({ error: 'server_error' });
  }

  cache = { value: count ?? 0, ts: Date.now() };

  return res.status(200).json({ count: cache.value, cached: false });
}
