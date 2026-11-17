// Shared by Projects, Devlogs and Design: entry, smooth scrolling, and rows easing in.
(function () {
  'use strict';

  const DHC = window.DHC;

  DHC.smoothScroll({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  });
  DHC.enter();

  const rows = Array.from(document.querySelectorAll('[data-reveal]'));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (rows.length && 'IntersectionObserver' in window && !calm) {
    document.documentElement.classList.add('reveals');
    let shown = 0;
    const seen = new IntersectionObserver(entries => {
      // Reaching a row also shows every row before it, so a jump down the page leaves none hidden.
      const reached = Math.max(...entries.filter(entry => entry.isIntersecting).map(entry => rows.indexOf(entry.target)));
      for (; shown <= reached; shown++) {
        rows[shown].classList.add('is-in');
        seen.unobserve(rows[shown]);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    rows.forEach(row => seen.observe(row));
    // Printing skips the observer, so show everything first.
    addEventListener('beforeprint', () => rows.forEach(row => row.classList.add('is-in')));
  }
})();
