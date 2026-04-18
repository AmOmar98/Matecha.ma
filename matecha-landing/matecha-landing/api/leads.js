import { createClient } from '@supabase/supabase-js';

// Alphabet excludes confusable characters: I, O, 0, 1
const OFFER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PHONE_RE = /^\+212[0-9]{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateOfferCode(prefix) {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += OFFER_ALPHABET[Math.floor(Math.random() * OFFER_ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const {
    whatsapp_number,
    email,
    consent_cndp,
    canal_optin,
  } = req.body ?? {};

  // Validation: consent must be explicitly true
  if (consent_cndp !== true) {
    return res.status(400).json({ error: 'missing_consent' });
  }

  // Validation: Moroccan WhatsApp number
  if (!whatsapp_number || !PHONE_RE.test(whatsapp_number)) {
    return res.status(400).json({ error: 'invalid_phone' });
  }

  // Validation: optional email
  if (email !== undefined && email !== null && email !== '') {
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
  }

  const prefix = process.env.LAUNCH_OFFER_CODE_PREFIX ?? 'MATECHA';
  const offer_code = generateOfferCode(prefix);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const row = {
    whatsapp_number,
    ...(email ? { email } : {}),
    consent_cndp,
    canal_optin: canal_optin ?? false,
    offer_code,
  };

  const { data, error } = await supabase
    .from('leads')
    .upsert(row, { onConflict: 'whatsapp_number', ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'already_registered' });
    }
    // Never log the service role key — only log safe info
    console.error('[leads] db error code:', error.code);
    return res.status(500).json({ error: 'server_error' });
  }

  return res.status(201).json({
    offer_code: data.offer_code,
    canal_url: process.env.CANAL_WHATSAPP_URL || null,
  });
}
