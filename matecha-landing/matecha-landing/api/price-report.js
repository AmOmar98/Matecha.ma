import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { product_id, product_name, supplier, reported_price_mad, correct_price_mad, reporter_wa, note } = req.body ?? {};
  if (!product_id || !product_name || !supplier) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from('price_reports').insert({
    product_id, product_name, supplier,
    reported_price_mad: reported_price_mad ?? null,
    correct_price_mad: correct_price_mad ?? null,
    reporter_wa: reporter_wa ?? null,
    note: (note ?? '').slice(0, 500),
  });
  if (error) return res.status(500).json({ error: 'server_error' });
  return res.status(201).json({ ok: true });
}
