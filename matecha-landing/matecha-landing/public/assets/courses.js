/**
 * courses.js — Interactive comparator (Tasks 14 + 15 + 16)
 * Loaded as ES module from courses.html
 */

/* ── Constants ─────────────────────────────────────────────────── */
const CART_KEY = 'matecha.cart';
const MAX_VISIBLE = 120;
const WA_NUMBER = '212675742868';
const CAT_LABELS = {
  epicerie: 'Épicerie',
  boissons: 'Boissons',
  laitiers: 'Produits laitiers',
  fruits_legumes: 'Fruits & Légumes',
  animalerie: 'Animalerie',
};

/* ── State ──────────────────────────────────────────────────────── */
const state = {
  catalog: [],
  filtered: [],
  query: '',
  category: 'all',
  cart: loadCart(),
  openProductId: null,
};

/* ── DOM refs ───────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const grid        = $('product-grid');
const cartPanel   = $('cart-panel');
const cartItems   = $('cart-items');
const cartCount   = $('cart-count');
const cartFab     = $('cart-fab');
const cartFabCnt  = $('cart-fab-count');
const cartTotal   = $('cart-total');
const cartSavings = $('cart-savings');
const sendWa      = $('send-wa');
const cartClose   = $('cart-close');
const overlay     = $('overlay');
const overlayBack = $('overlay-backdrop');
const overlayClose= $('overlay-close');
const overlayBody = $('overlay-body');
const catalogDate = $('catalog-date');
const resultCount = $('result-count');
const searchInput = $('q');

/* ── Utilities ──────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '{}');
  } catch {
    return {};
  }
}

function persistCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch { /* storage full — ignore */ }
}

/* ── Boot: load catalog ─────────────────────────────────────────── */
async function boot() {
  try {
    const res = await fetch('/assets/data/catalog-search.json');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.catalog = data.products || [];

    if (catalogDate && data.generated_at) {
      const d = new Date(data.generated_at);
      catalogDate.textContent = isNaN(d)
        ? data.generated_at
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    applyFilters();
    renderCart();
  } catch {
    if (grid) {
      grid.innerHTML = '<p class="error-msg">Catalogue temporairement indisponible. Réessayez dans quelques instants.</p>';
    }
  }
}

/* ── Filtering ──────────────────────────────────────────────────── */
function applyFilters() {
  const q = normalize(state.query);
  state.filtered = state.catalog.filter((p) => {
    const matchCat = state.category === 'all' || p.category === state.category;
    const matchQ = !q || normalize(p.name + ' ' + p.brand).includes(q);
    return matchCat && matchQ;
  });
  renderGrid();
  if (resultCount) {
    resultCount.textContent =
      state.filtered.length === 0
        ? 'Aucun résultat'
        : `${state.filtered.length} produit${state.filtered.length > 1 ? 's' : ''}`;
  }
}

/* ── Grid rendering ─────────────────────────────────────────────── */
function renderGrid() {
  if (!grid) return;

  if (state.filtered.length === 0) {
    grid.innerHTML = '<p class="empty-state">Aucun produit ne correspond à votre recherche.</p>';
    return;
  }

  const visible = state.filtered.slice(0, MAX_VISIBLE);
  grid.innerHTML = visible.map(cardHTML).join('');
}

function cardHTML(p) {
  const inCart = !!state.cart[p.id];
  const addLabel = inCart ? '✓ Dans la liste' : '+ Ajouter';
  const addClass = inCart ? 'add-btn add-btn--in-cart' : 'add-btn';

  const savingsBadge = p.savings_pct > 0
    ? `<span class="savings-badge">−${escapeHtml(p.savings_pct)}% vs ${escapeHtml(capitalize(p.worst_supplier))}</span>`
    : '';

  return `
<article class="product-card" role="button" tabindex="0"
         data-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.name)}">
  <div class="brand">${escapeHtml(p.brand)}</div>
  <h3>${escapeHtml(p.name)}</h3>
  <div class="price-row">
    <span class="price">${escapeHtml(String(p.best_price_mad))} dh</span>
    <span class="supplier">${escapeHtml(capitalize(p.best_supplier))}</span>
  </div>
  ${savingsBadge}
  <button class="${escapeHtml(addClass)}" data-action="add" data-id="${escapeHtml(p.id)}"
          aria-label="${inCart ? 'Retirer de la liste' : 'Ajouter à la liste'}">${addLabel}</button>
</article>`.trim();
}

/* ── Overlay ────────────────────────────────────────────────────── */
let lastFocus = null;

function openOverlay(id) {
  const p = state.catalog.find((x) => x.id === id);
  if (!p || !overlay || !overlayBody) return;

  state.openProductId = id;
  lastFocus = document.activeElement;

  overlayBody.innerHTML = buildOverlayHTML(p);
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  if (overlayClose) overlayClose.focus();
}

function closeOverlay() {
  if (!overlay) return;
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.openProductId = null;
  if (lastFocus) lastFocus.focus();
}

function buildOverlayHTML(p) {
  const inCart = !!state.cart[p.id];
  const catLabel = CAT_LABELS[p.category] || escapeHtml(p.category);

  let savingsNote = '';
  if (p.savings_pct > 0) {
    savingsNote = `<p class="savings-note">Économisez jusqu'à <strong>${escapeHtml(String(p.savings_pct))}%</strong>
      en choisissant <strong>${escapeHtml(capitalize(p.best_supplier))}</strong>
      plutôt que <strong>${escapeHtml(capitalize(p.worst_supplier))}</strong>.</p>`;
  }

  const suppliersHTML = (p.suppliers || [])
    .slice()
    .sort((a, b) => a.price_mad - b.price_mad)
    .map((s) => {
      const isBest = s.supplier === p.best_supplier;
      const tag = isBest ? '<span class="tag">Meilleur prix</span>' : '';
      return `<li class="supplier-row${isBest ? ' is-best' : ''}">
        <span class="sup-name">${escapeHtml(capitalize(s.supplier))}${tag}</span>
        <span class="sup-price">${escapeHtml(String(s.price_mad))} dh</span>
      </li>`;
    })
    .join('');

  const addLabel = inCart ? '✓ Déjà dans la liste' : '+ Ajouter à ma liste';
  const addClass = inCart ? 'btn-add btn-add--in' : 'btn-add';

  return `
<h2 id="ov-title">${escapeHtml(p.name)}</h2>
<div class="brand-cat">${escapeHtml(p.brand)} · ${escapeHtml(catLabel)}</div>
${savingsNote}
<ul class="suppliers">${suppliersHTML}</ul>
<div class="overlay-actions">
  <button class="${escapeHtml(addClass)}" data-action="add-overlay" data-id="${escapeHtml(p.id)}">${addLabel}</button>
  <button class="btn-report" data-action="report" data-id="${escapeHtml(p.id)}">Signaler un prix incorrect</button>
</div>`.trim();
}

function refreshOverlay() {
  if (state.openProductId) {
    const p = state.catalog.find((x) => x.id === state.openProductId);
    if (p && overlayBody) overlayBody.innerHTML = buildOverlayHTML(p);
  }
}

/* ── Cart ───────────────────────────────────────────────────────── */
function addToCart(id) {
  const p = state.catalog.find((x) => x.id === id);
  if (!p) return;

  if (state.cart[id]) {
    delete state.cart[id];
  } else {
    state.cart[id] = {
      id: p.id,
      name: p.name,
      brand: p.brand,
      best_supplier: p.best_supplier,
      best_price_mad: p.best_price_mad,
      worst_price_mad: p.worst_price_mad,
      added_at: Date.now(),
    };
  }

  persistCart();
  renderGrid();
  renderCart();
  refreshOverlay();
}

function renderCart() {
  const items = Object.values(state.cart).sort((a, b) => b.added_at - a.added_at);
  const count = items.length;

  if (cartCount)    cartCount.textContent = count;
  if (cartFabCnt)   cartFabCnt.textContent = count;

  if (cartItems) {
    if (count === 0) {
      cartItems.innerHTML = '<p class="cart-empty">Votre liste est vide. Cliquez sur « Ajouter » sous un produit.</p>';
    } else {
      cartItems.innerHTML = items.map((item) => `
<div class="cart-item">
  <div class="cart-item-info">
    <span class="cart-item-name">${escapeHtml(item.name)}</span>
    <span class="cart-item-price">${escapeHtml(String(item.best_price_mad))} dh · ${escapeHtml(capitalize(item.best_supplier))}</span>
  </div>
  <button class="cart-remove" data-action="cart-remove" data-id="${escapeHtml(item.id)}"
          aria-label="Retirer ${escapeHtml(item.name)}">×</button>
</div>`).join('');
    }
  }

  const total    = items.reduce((s, x) => s + x.best_price_mad, 0);
  const worstSum = items.reduce((s, x) => s + x.worst_price_mad, 0);
  const savings  = worstSum - total;

  if (cartTotal)   cartTotal.textContent   = total.toFixed(2) + ' dh';
  if (cartSavings) cartSavings.textContent = savings.toFixed(2) + ' dh';
  if (sendWa)      sendWa.disabled         = count === 0;
}

/* ── WhatsApp ───────────────────────────────────────────────────── */
function sendWhatsApp() {
  const items = Object.values(state.cart).sort((a, b) => b.added_at - a.added_at);
  if (items.length === 0) return;

  const total    = items.reduce((s, x) => s + x.best_price_mad, 0);
  const worstSum = items.reduce((s, x) => s + x.worst_price_mad, 0);
  const savings  = worstSum - total;

  const bullets = items
    .map((x) => `• ${x.name} → ${x.best_price_mad} dh (${capitalize(x.best_supplier)})`)
    .join('\n');

  let msg = `Salam ! Ma liste Matecha :\n\n${bullets}\n\nTotal estimé : ${total.toFixed(2)} dh`;
  if (savings > 0) {
    msg += `\nÉconomie vs pire prix : ${savings.toFixed(2)} dh`;
  }
  msg += '\n\nMerci de confirmer la disponibilité et les prix finaux 🙏';

  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank', 'noopener');
}

/* ── Price report ───────────────────────────────────────────────── */
async function submitPriceReport(id) {
  const p = state.catalog.find((x) => x.id === id);
  if (!p) return;

  const supplierList = (p.suppliers || []).map((s) => capitalize(s.supplier)).join(', ');
  const supplier = window.prompt(`Quel supermarché ?\n(${supplierList})`);
  if (!supplier) return;

  const rawPrice = window.prompt('Quel est le prix constaté ? (dh, optionnel)');
  const reportedPrice = rawPrice ? parseFloat(rawPrice) : null;

  try {
    const res = await fetch('/api/price-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: p.id,
        product_name: p.name,
        supplier: supplier.trim().toLowerCase(),
        reported_price_mad: isNaN(reportedPrice) ? null : reportedPrice,
        correct_price_mad: isNaN(reportedPrice) ? null : reportedPrice,
      }),
    });
    if (res.ok) {
      window.alert('Merci ! Votre signalement a été envoyé.');
    } else {
      window.alert('Une erreur est survenue. Réessayez dans quelques instants.');
    }
  } catch {
    window.alert('Une erreur est survenue. Réessayez dans quelques instants.');
  }
}

/* ── Event delegation ───────────────────────────────────────────── */
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    if (action === 'add') {
      e.stopPropagation();
      addToCart(id);
      return;
    }
    if (action === 'add-overlay') { addToCart(id); return; }
    if (action === 'cart-remove') { addToCart(id); return; }
    if (action === 'report')      { submitPriceReport(id); return; }
  }

  // Card click → open overlay
  const card = e.target.closest('.product-card');
  if (card) {
    openOverlay(card.dataset.id);
    return;
  }

  // Cart FAB
  if (e.target.closest('#cart-fab')) {
    if (cartPanel) cartPanel.classList.toggle('is-open');
    return;
  }
  // Cart close
  if (e.target.closest('#cart-close')) {
    if (cartPanel) cartPanel.classList.remove('is-open');
    return;
  }
  // Send WA
  if (e.target.closest('#send-wa')) {
    sendWhatsApp();
    return;
  }
  // Overlay close button
  if (e.target.closest('#overlay-close')) {
    closeOverlay();
    return;
  }
  // Overlay backdrop
  if (e.target === overlayBack) {
    closeOverlay();
    return;
  }
});

// Keyboard: card Enter/Space, ESC closes overlay
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeOverlay(); return; }
  if (e.key === 'Enter' || e.key === ' ') {
    const card = document.activeElement && document.activeElement.closest('.product-card');
    if (card) { e.preventDefault(); openOverlay(card.dataset.id); }
  }
});

/* ── Search & category listeners ───────────────────────────────── */
if (searchInput) {
  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    applyFilters();
  });
}

document.querySelectorAll('.cat-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    state.category = chip.dataset.cat || 'all';
    document.querySelectorAll('.cat-chip').forEach((c) => {
      const active = c === chip;
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    applyFilters();
  });
});

/* ── Init ───────────────────────────────────────────────────────── */
boot();
