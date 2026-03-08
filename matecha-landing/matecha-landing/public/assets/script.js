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
    burger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('show');
      burger.classList.toggle('open');
      burger.setAttribute('aria-expanded', isOpen);
      burger.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    });

    // Close on link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('show');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Ouvrir le menu');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (nav && !nav.contains(e.target) && navLinks.classList.contains('show')) {
        navLinks.classList.remove('show');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('show')) {
        navLinks.classList.remove('show');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
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
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      if (!item) return;
      const wasOpen = item.classList.contains('open');
      // Close all other items
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
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
