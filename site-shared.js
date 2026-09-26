(function () {
  'use strict';

  const root = document.documentElement;
  const site = window.DHCSite = window.DHCSite || {};
  site.fontsReady = document.fonts ? Promise.allSettled([
    document.fonts.load('900 52px "Big Shoulders Display"'),
    document.fonts.load('700 32px "Big Shoulders Display"'),
    document.fonts.load('400 14px "IBM Plex Sans"'),
    document.fonts.load('500 14px "IBM Plex Sans"'),
    document.fonts.load('600 24px "IBM Plex Sans"')
  ]).then(() => document.fonts.ready) : Promise.resolve();
  site.fontsReady.then(() => { root.dataset.fonts = 'ready'; });

  document.addEventListener('contextmenu', event => event.preventDefault(), { capture: true });
  ['dragstart', 'dragover', 'drop'].forEach(type => {
    document.addEventListener(type, event => event.preventDefault(), { capture: true });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true });

  const interactive = 'a, button, input, textarea, select, summary, [role="button"], [contenteditable="true"]';
  document.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || event.target.closest(interactive)) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const anchor = selection.anchorNode?.parentElement?.closest('.allow-select');
    const focus = selection.focusNode?.parentElement?.closest('.allow-select');
    if (anchor || focus) selection.removeAllRanges();
  }, { capture: true, passive: true });

  document.querySelectorAll('.brand, .brand-inline').forEach(function (brand) {
    let startX = 0;
    let startY = 0;
    let selecting = false;
    let hadSelection = false;
    let pointerId = null;
    brand.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || !event.isPrimary) return;
      startX = event.clientX;
      startY = event.clientY;
      selecting = false;
      pointerId = event.pointerId;
      const selection = window.getSelection();
      hadSelection = !!selection && !selection.isCollapsed;
    });
    window.addEventListener('pointermove', function (event) {
      if (event.pointerId !== pointerId) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 3) selecting = true;
    }, { passive: true });
    window.addEventListener('pointerup', function (event) {
      if (event.pointerId !== pointerId) return;
      selecting = selecting || Math.hypot(event.clientX - startX, event.clientY - startY) > 3;
      pointerId = null;
    }, { capture: true, passive: true });
    window.addEventListener('pointercancel', function () {
      pointerId = null;
      selecting = true;
    });
    brand.addEventListener('click', function (event) {
      const selection = window.getSelection();
      if (selecting || hadSelection || (selection && !selection.isCollapsed) || event.detail > 1) {
        event.preventDefault();
        return;
      }
      window.showIntroOverlay?.();
      brand.blur();
    });
    brand.addEventListener('keydown', function (event) {
      if (brand.tagName !== 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        window.showIntroOverlay?.();
        brand.blur();
      }
    });
  });

  window.addEventListener('pageshow', function() {
    document.querySelectorAll('.brand, .brand-inline').forEach(function(el) {
      if (document.activeElement === el) el.blur();
    });
  });

  const hints = Array.from(document.querySelectorAll('[data-scroll-target]'));
  hints.forEach(function (hint) {
    hint.addEventListener('click', function () {
      const target = document.querySelector(hint.dataset.scrollTarget);
      if (!target) return;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (site.scroller && !reduced) site.scroller.scrollTo(target, { duration: 1 });
      else target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    });
  });
  function updateHints() {
    const hidden = window.scrollY > 80 || root.scrollHeight <= root.clientHeight + 2;
    hints.forEach(function (hint) {
      const target = document.querySelector(hint.dataset.scrollTarget);
      const sectionTop = target?.getBoundingClientRect().top ?? window.innerHeight;
      hint.style.bottom = Math.max(32, window.innerHeight - sectionTop + 24) + 'px';
      hint.classList.toggle('is-hidden', hidden);
      hint.setAttribute('aria-hidden', String(hidden));
      hint.tabIndex = hidden ? -1 : 0;
    });
  }
  window.addEventListener('scroll', updateHints, { passive: true });
  window.addEventListener('resize', updateHints, { passive: true });
  window.addEventListener('pageshow', updateHints);
  site.fontsReady.then(updateHints);
  updateHints();
})();
