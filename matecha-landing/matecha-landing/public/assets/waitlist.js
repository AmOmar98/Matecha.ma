// waitlist.js
(function () {
  const form = document.getElementById('waitlist-form');
  const success = document.getElementById('waitlist-success');
  const errorEl = document.getElementById('waitlist-error');
  const countEl = document.getElementById('waitlist-count');
  if (!form) return;

  fetch('/api/leads-count').then(r => r.ok ? r.json() : null).then(d => {
    if (d && typeof d.count === 'number' && countEl) {
      countEl.textContent = `${d.count} personnes déjà inscrites à Fès`;
    }
  }).catch(() => {});

  function normalizePhone(raw) {
    const digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('212')) return '+' + digits;
    if (digits.startsWith('0') && digits.length === 10) return '+212' + digits.slice(1);
    if (digits.length === 9) return '+212' + digits;
    return null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Envoi…';

    const raw = form.querySelector('#wa-number').value.trim();
    const email = form.querySelector('#wa-email').value.trim() || undefined;
    const consent = form.querySelector('#wa-consent').checked;
    const canal_optin = form.querySelector('#wa-canal').checked;
    const whatsapp_number = normalizePhone(raw);

    if (!whatsapp_number) {
      errorEl.textContent = 'Numéro marocain invalide (ex : 0675742868).';
      btn.disabled = false; btn.textContent = 'Réserver ma place';
      return;
    }
    if (!consent) {
      errorEl.textContent = 'Consentement obligatoire pour continuer.';
      btn.disabled = false; btn.textContent = 'Réserver ma place';
      return;
    }

    try {
      const resp = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number, email, consent_cndp: true, canal_optin }),
      });
      const data = await resp.json();
      if (!resp.ok && resp.status !== 409) {
        const map = {
          invalid_phone: 'Numéro invalide.',
          invalid_email: 'Email invalide.',
          missing_consent: 'Consentement requis.',
          server_error: 'Erreur serveur, réessayez dans un instant.',
        };
        errorEl.textContent = map[data.error] ?? 'Erreur inattendue.';
        btn.disabled = false; btn.textContent = 'Réserver ma place';
        return;
      }
      form.style.display = 'none';
      success.style.display = 'block';
      const codeEl = success.querySelector('.code');
      if (codeEl && data.offer_code) codeEl.textContent = data.offer_code;
      const canalBtn = success.querySelector('.canal-cta');
      if (canalBtn && data.canal_url) {
        canalBtn.href = data.canal_url;
        canalBtn.style.display = 'inline-flex';
      }
    } catch (err) {
      errorEl.textContent = 'Connexion impossible. Vérifiez votre réseau.';
      btn.disabled = false; btn.textContent = 'Réserver ma place';
    }
  });
})();
