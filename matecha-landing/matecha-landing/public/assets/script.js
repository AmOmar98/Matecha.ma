// ═══════════════════════════════════════════
// MATECHA — Main Scripts
// ═══════════════════════════════════════════

(function () {
  'use strict';

  // ─── NAVBAR scroll effect ───
  const nav = document.getElementById('navbar');
  const backToTop = document.getElementById('backToTop');

  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
      if (backToTop) backToTop.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
  }

  // ─── BACK TO TOP ───
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ─── MOBILE NAV ───
  const burger = document.getElementById('navBurger');
  const navLinks = document.getElementById('navLinks');

  if (burger && navLinks) {
    const closeNav = () => {
      navLinks.classList.remove('show');
      burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Ouvrir le menu');
    };

    burger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('show');
      burger.classList.toggle('open');
      burger.setAttribute('aria-expanded', isOpen);
      burger.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    });

    // Close on link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeNav);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (nav && !nav.contains(e.target) && navLinks.classList.contains('show')) {
        closeNav();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('show')) {
        closeNav();
        burger.focus();
      }
    });
  }

  // ─── ACTIVE NAV LINK on scroll ───
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = navLinks ? navLinks.querySelectorAll('a[href^="#"]') : [];

  if (sections.length && navAnchors.length) {
    const sectionObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navAnchors.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { threshold: 0.25, rootMargin: '-80px 0px -40% 0px' });
    sections.forEach(s => sectionObs.observe(s));
  }

  // ─── SCROLL REVEAL ───
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach(el => revealObs.observe(el));
  }

  // ─── ANIMATED COUNTERS ───
  const counters = document.querySelectorAll('[data-target]');
  if (counters.length) {
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.target, 10);
          const suffix = el.textContent.replace(/[0-9]/g, '');
          let current = 0;
          const step = Math.ceil(target / 35);
          const timer = setInterval(() => {
            current += step;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            el.textContent = current + suffix;
          }, 30);
          counterObs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(c => counterObs.observe(c));
  }

  // ─── FAQ ACCORDION ───
  const faqItems = document.querySelectorAll('.faq-item');
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      if (!item) return;
      const wasOpen = item.classList.contains('open');
      // Close all other items
      faqItems.forEach(openItem => {
        openItem.classList.remove('open');
        const openBtn = openItem.querySelector('.faq-q');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      });
      // Toggle clicked item
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ─── PRICE COMPARATOR (UX demo from consolidated DB) ───
  const compareData = [
    {
      id: 'lait-uht-pack6',
      icon: '🥛',
      category: 'Produits Laitiers & Œufs',
      product: 'Lait UHT Entier (Pack 6)',
      format: '6 x 1L',
      offers: [
        { seller: 'Marjane', price: 57.95 },
        { seller: 'Carrefour', price: 56.95 },
        { seller: 'Kazyon', price: 54.95 }
      ]
    },
    {
      id: 'tomate-ronde',
      icon: '🍅',
      category: 'Marché',
      product: 'Tomate ronde',
      format: '1kg',
      offers: [
        { seller: 'Marjane', price: 6.90 },
        { seller: 'Carrefour', price: 7.50 }
      ]
    },
    {
      id: 'eau-minerale-ain-saiss',
      icon: '💧',
      category: 'Boissons & Eaux',
      product: 'Eau minérale Ain Saïss',
      format: '1,5L',
      offers: [
        { seller: 'Marjane', price: 4.95 },
        { seller: 'Carrefour', price: 5.50 },
        { seller: 'BIM', price: 3.70 }
      ]
    },
    {
      id: 'lentilles-1kg',
      icon: '🫘',
      category: 'Épicerie de Base',
      product: 'Lentilles',
      format: '1kg',
      offers: [
        { seller: 'Marjane', price: 9.50 },
        { seller: 'Carrefour', price: 21.50 },
        { seller: 'Kazyon', price: 9.95 }
      ]
    },
    {
      id: 'ketchup-500g',
      icon: '🍅',
      category: 'Conserves & Condiments',
      product: 'Ketchup (500g)',
      format: '500g',
      offers: [
        { seller: 'Marjane', price: 15.50 },
        { seller: 'Carrefour', price: 16.50 },
        { seller: 'BIM', price: 13.90 }
      ]
    },
    {
      id: 'lessive-liquide',
      icon: '🧼',
      category: 'Entretien Maison & Nettoyants',
      product: 'Lessive liquide',
      format: '3L à 5L',
      offers: [
        { seller: 'Marjane', price: 89.95 },
        { seller: 'Carrefour', price: 82.95 },
        { seller: 'BIM', price: 44.90 },
        { seller: 'Kazyon', price: 49.00 }
      ]
    }
  ];

  const productSelect = document.getElementById('productSelect');
  const compareBtn = document.getElementById('compareBtn');
  const compareResults = document.getElementById('compareResults');
  const compareProductName = document.getElementById('compareProductName');
  const compareProductMeta = document.getElementById('compareProductMeta');
  const compareProductHeader = document.getElementById('compareProductHeader');
  const compareEconomy = document.getElementById('compareEconomy');

  const formatMad = (value) => `${value.toFixed(2).replace('.', ',')} MAD`;

  const renderComparison = (productId) => {
    const item = compareData.find((p) => p.id === productId) || compareData[0];
    if (!item || !compareResults) return;

    const ranked = [...item.offers].sort((a, b) => a.price - b.price);
    const mostExpensive = ranked[ranked.length - 1];
    const economy = mostExpensive.price - ranked[0].price;

    if (compareProductHeader) {
      const emojiEl = compareProductHeader.querySelector('.compare-product-img');
      if (emojiEl) emojiEl.textContent = item.icon;
    }
    if (compareProductName) compareProductName.textContent = item.product;
    if (compareProductMeta) compareProductMeta.textContent = `${item.category} · ${item.format}`;

    compareResults.innerHTML = ranked.map((offer, index) => {
      const isWinner = index === 0;
      const rowClass = isWinner ? 'winner' : 'loser';
      const label = isWinner ? 'Matecha · Meilleur prix' : offer.seller;
      return `
        <div class="compare-supplier ${rowClass}">
          <div class="name">${label}${isWinner ? ' <span class="tag">Lowest</span>' : ''}</div>
          <div class="amt">${formatMad(offer.price)}</div>
        </div>
      `;
    }).join('');

    if (compareEconomy) {
      compareEconomy.innerHTML = `En passant par Matecha au lieu de <strong>${mostExpensive.seller}</strong>, vous économisez jusqu'à <strong>${formatMad(economy)}</strong> sur ce produit.`;
    }
  };

  if (productSelect && compareBtn && compareResults) {
    productSelect.innerHTML = compareData.map((item) => (
      `<option value="${item.id}">${item.product} (${item.format})</option>`
    )).join('');

    renderComparison(compareData[0].id);
    const handleCompare = () => renderComparison(productSelect.value);
    compareBtn.addEventListener('click', handleCompare);
    productSelect.addEventListener('change', handleCompare);
  }

  // ─── PARTNER FORM (simple validation) ───
  const partnerForm = document.getElementById('partnerForm');
  if (partnerForm) {
    partnerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = partnerForm.querySelector('[name="name"]');
      const phone = partnerForm.querySelector('[name="phone"]');
      if (name && phone && name.value.trim() && phone.value.trim()) {
        const msg = encodeURIComponent(
          `Salam! Je suis ${name.value.trim()} et je veux devenir partenaire fournisseur Matecha. Mon numéro : ${phone.value.trim()}`
        );
        window.open(`https://wa.me/212675742868?text=${msg}`, '_blank');
      }
    });
  }

})();
