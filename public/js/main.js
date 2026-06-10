/**
 * Carlington & Burling LLP — Main JavaScript
 * Mobile nav, scroll effects, active nav links, accordion, skip link
 */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const navDrawer = document.getElementById('nav-drawer');
  const navOverlay = document.querySelector('.nav-drawer__overlay');

  /* ----- Mobile Nav Toggle ----- */
  if (navToggle && navDrawer && navOverlay) {
    const closeDrawer = () => {
      navDrawer.classList.remove('nav-drawer--open');
      navOverlay.classList.remove('nav-drawer__overlay--visible');
      navToggle.setAttribute('aria-expanded', 'false');
      navDrawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    const openDrawer = () => {
      navDrawer.classList.add('nav-drawer--open');
      navOverlay.classList.add('nav-drawer__overlay--visible');
      navToggle.setAttribute('aria-expanded', 'true');
      navDrawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };

    navToggle.addEventListener('click', () => {
      const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      isOpen ? closeDrawer() : openDrawer();
    });

    navOverlay.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          closeDrawer();
          navToggle.focus();
        }
      }
    });

    navDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeDrawer);
    });
  }

  /* ----- Header Scroll Effect ----- */
  if (header) {
    const onScroll = () => {
      header.classList.toggle('site-header--scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ----- Active Nav Link ----- */
  var currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  var setActive = function (selector) {
    document.querySelectorAll(selector).forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (href === currentPath) {
        link.classList.add(selector === '.nav-desktop__link' ? 'nav-desktop__link--active' : 'nav-drawer__link--active');
      }
    });
  };
  setActive('.nav-desktop__link');
  setActive('.nav-drawer__link');

  /* ----- Accordion ----- */
  document.querySelectorAll('.accordion__trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (panel) {
        if (expanded) {
          panel.classList.remove('accordion__panel--open');
          panel.setAttribute('aria-hidden', 'true');
        } else {
          panel.classList.add('accordion__panel--open');
          panel.setAttribute('aria-hidden', 'false');
        }
      }
    });
  });

  /* ----- Smooth Scroll for Anchor Links ----- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        target.focus({ preventScroll: true });
      }
    });
  });
});