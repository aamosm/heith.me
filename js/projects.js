// The archive drifting behind the Projects title.
(function () {
  'use strict';

  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  // Width and height of assets/gallery/01.webp onward, so the columns keep their shape while loading.
  const SHOTS = [
    [820, 820], [820, 820], [820, 386], [820, 653], [510, 759], [820, 488], [820, 504], [820, 461],
    [820, 424], [820, 413], [486, 546], [820, 474], [413, 358], [332, 327], [820, 461], [394, 665],
    [820, 455], [820, 441], [820, 369], [820, 190], [820, 364], [820, 392], [820, 547]
  ];
  const base = new URL('assets/gallery/', window.DHC.base);

  const order = SHOTS.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const tracks = Array.from(gallery.children);
  tracks.forEach((track, column) => {
    const shots = order.filter((_, position) => position % tracks.length === column);
    // Each column holds its images twice, so the loop has no seam.
    track.innerHTML = shots.concat(shots).map(index => {
      const [width, height] = SHOTS[index];
      const file = String(index + 1).padStart(2, '0') + '.webp';
      return `<img src="${new URL(file, base).href}" width="${width}" height="${height}" alt="" decoding="async" fetchpriority="low">`;
    }).join('');
  });

  // No point animating what the sheet has covered.
  const hero = document.querySelector('.hero');
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      gallery.classList.toggle('is-paused', !entries[0].isIntersecting);
    }).observe(hero);
  }
})();
