(function () {
  'use strict';

  const root = document.documentElement;
  const DHC = window.DHC = {
    base: new URL('../', document.currentScript.src),
    quiet: root.dataset.entry === 'quiet',
    scroller: null
  };

  // Text waits for its fonts, but only so long.
  DHC.loadFonts = function (specs, limit = 2500) {
    if (!document.fonts) return Promise.resolve();
    return Promise.race([
      Promise.allSettled(specs.map(spec => document.fonts.load(spec))),
      new Promise(resolve => setTimeout(resolve, limit))
    ]);
  };
  DHC.fontsReady = DHC.loadFonts(['700 1em "Big Shoulders Display"', '400 1em "IBM Plex Sans"']);
  DHC.fontsReady.then(() => { root.dataset.fonts = 'ready'; });

  // Links inside the site carry ?v=d to skip the introduction. Drop it once it has done its job.
  if (DHC.quiet) {
    const url = new URL(location.href);
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v');
      history.replaceState(history.state, '', url);
    }
  }

  ['contextmenu', 'dragstart', 'dragover', 'drop'].forEach(type => {
    document.addEventListener(type, event => event.preventDefault(), { capture: true });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true });

  const controls = 'a, button, input, textarea, select, summary, [role="button"], [contenteditable="true"]';
  const brandOf = target => (target instanceof Element ? target.closest('.brand, .brand-inline') : null);
  const inSelectable = node => !!node?.parentElement?.closest('.allow-select');

  // Clicking anywhere else lets go of selected initials.
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest(controls))) return;
    const selection = getSelection();
    if (!selection || selection.isCollapsed) return;
    if (inSelectable(selection.anchorNode) || inSelectable(selection.focusNode)) selection.removeAllRanges();
  }, { capture: true, passive: true });

  // A click on the initials opens the introduction. Dragging across them selects the text instead.
  let press = null;
  document.addEventListener('pointerdown', event => {
    const brand = brandOf(event.target);
    if (!brand || event.button !== 0 || !event.isPrimary) { press = null; return; }
    const selection = getSelection();
    press = {
      brand, id: event.pointerId, x: event.clientX, y: event.clientY,
      dragged: false, hadSelection: !!selection && !selection.isCollapsed
    };
  }, { capture: true, passive: true });
  document.addEventListener('pointermove', event => {
    if (press && event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 3) press.dragged = true;
  }, { passive: true });
  document.addEventListener('pointercancel', () => { if (press) press.dragged = true; });

  function openIntro(brand) {
    DHC.intro?.show();
    brand.blur();
  }
  document.addEventListener('click', event => {
    const brand = brandOf(event.target);
    if (!brand) return;
    const selection = getSelection();
    const selecting = press?.brand === brand && (press.dragged || press.hadSelection);
    press = null;
    if (selecting || (selection && !selection.isCollapsed) || event.detail > 1) {
      event.preventDefault();
      return;
    }
    openIntro(brand);
  });
  document.addEventListener('keydown', event => {
    const brand = brandOf(event.target);
    if (!brand || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openIntro(brand);
  });

  const hints = Array.from(document.querySelectorAll('[data-scroll-target]'));
  hints.forEach(hint => {
    hint.addEventListener('click', () => {
      const target = document.querySelector(hint.dataset.scrollTarget);
      if (!target) return;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (DHC.scroller && !reduced) DHC.scroller.scrollTo(target, { duration: 1 });
      else target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    });
  });
  // The hint rides just above the section it points to, then steps aside.
  function placeHints() {
    const hidden = window.scrollY > 80 || root.scrollHeight <= root.clientHeight + 2;
    hints.forEach(hint => {
      const target = document.querySelector(hint.dataset.scrollTarget);
      const top = target ? target.getBoundingClientRect().top : window.innerHeight;
      hint.style.bottom = Math.max(32, window.innerHeight - top + Number(hint.dataset.scrollGap || 24)) + 'px';
      hint.classList.toggle('is-hidden', hidden);
      hint.setAttribute('aria-hidden', String(hidden));
      hint.tabIndex = hidden ? -1 : 0;
    });
  }
  if (hints.length) {
    window.addEventListener('scroll', placeHints, { passive: true });
    window.addEventListener('resize', placeHints, { passive: true });
    window.addEventListener('pageshow', placeHints);
    DHC.fontsReady.then(placeHints);
    placeHints();
  }

  window.addEventListener('pageshow', () => {
    const brand = brandOf(document.activeElement);
    if (brand) brand.blur();
  });

  // The markup holds the first year. Later years turn it into a range.
  const year = new Date().getFullYear();
  document.querySelectorAll('[data-year]').forEach(node => {
    const first = Number(node.textContent) || year;
    node.textContent = year > first ? first + '–' + year : String(first);
  });

  DHC.smoothScroll = function (options) {
    if (typeof window.Lenis !== 'function') return null;
    const lenis = DHC.scroller = new window.Lenis(options);
    let frame = 0;
    const tick = time => { lenis.raf(time); frame = requestAnimationFrame(tick); };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = document.hidden ? 0 : requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', sync);
    sync();
    if (DHC.intro?.isOpen()) lenis.stop();
    return lenis;
  };
})();
