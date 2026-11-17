// The portfolio viewer: fits the A4 pages to the stage, tracks the section in view, zooms on click.
(function () {
  'use strict';

  const DHC = window.DHC;
  const root = document.documentElement;
  const stage = document.getElementById('stage-container');
  const doc = document.getElementById('doc');
  const pages = Array.from(doc.children).filter(node => node.classList.contains('page'));
  if (!stage || !pages.length) return;

  DHC.designFontsReady = Promise.all([DHC.fontsReady, DHC.loadFonts(['400 1em "Manrope"', '400 1em "JetBrains Mono"'])]);
  DHC.designFontsReady.then(() => { root.dataset.designFonts = 'ready'; });

  // ?view=document shows the same pages with nothing around them.
  const plain = root.dataset.view === 'document';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const brand = document.getElementById('navBrand');
  const coverBrand = doc.querySelector('[data-cover-brand]');
  const links = Array.from(document.querySelectorAll('#tracker-list .tracker-item'));
  const select = document.getElementById('section-select');
  const zoomButton = document.getElementById('zoom-toggle');
  const progress = document.getElementById('reading-progress');
  const scrollHint = document.getElementById('viewer-scroll-hint');
  const metaTitle = document.getElementById('meta-title');
  const metaDesc = document.getElementById('meta-desc');
  const metaCount = document.getElementById('meta-count');

  let scale = 1;
  let expanded = false;
  let active = -1;
  let frame = 0;
  let zoomFrame = 0;
  let zoomPulse = 0;
  let printing = false;

  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const pad = n => String(n).padStart(2, '0');
  const svg = (name, attrs = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };

  // Each page sits in a slot that takes its scaled size, so the layout never has to guess.
  const entries = pages.map((page, index) => {
    const width = page.offsetWidth;
    const height = page.offsetHeight;
    const slot = document.createElement('div');
    const fit = document.createElement('div');
    slot.className = 'page-slot';
    fit.className = 'page-fit';
    fit.style.width = `${width}px`;
    fit.style.height = `${height}px`;
    page.before(slot);
    slot.appendChild(fit);
    fit.appendChild(page);
    return { page, slot, fit, width, height, index, effect: null };
  });

  /* Pages break into coarse pixels as they pass under the top edge, and during a zoom */

  const defs = svg('defs');
  const filterHost = svg('svg', { class: 'pixel-filters', 'aria-hidden': 'true', focusable: 'false' });
  filterHost.appendChild(defs);
  document.body.appendChild(filterHost);

  // Four bands, each sampling the page on its own grid and swelling the samples into blocks.
  function createEffect({ width, height, index }) {
    const id = `page-pixels-${index}`;
    const filter = svg('filter', {
      id, x: 0, y: 0, width, height,
      filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB'
    });
    const bands = [];
    for (let i = 0; i < 4; i++) {
      const p = `b${i}`;
      const dot = svg('feFlood', { x: 0, y: 0, width: 1, height: 1, 'flood-color': 'white', result: `${p}dot` });
      const cell = svg('feComposite', { in: `${p}dot`, in2: `${p}dot`, operator: 'over', x: 0, y: 0, width: 4, height: 4, result: `${p}cell` });
      const tile = svg('feTile', { in: `${p}cell`, x: 0, y: 0, width, height, result: `${p}grid` });
      const samples = svg('feComposite', { in: 'SourceGraphic', in2: `${p}grid`, operator: 'in', result: `${p}samples` });
      const dilate = svg('feMorphology', { in: `${p}samples`, operator: 'dilate', radius: 2, result: `${p}pixels` });
      const mask = svg('feFlood', { x: 0, y: 0, width, height: 0, 'flood-color': 'white', result: `${p}mask` });
      const band = svg('feComposite', { in: `${p}pixels`, in2: `${p}mask`, operator: 'in', result: `${p}band` });
      filter.append(dot, cell, tile, samples, dilate, mask, band);
      bands.push({ dot, cell, tile, samples, dilate, mask, width, block: 0, y: -1, height: -1, regionY: -1, regionHeight: -1 });
    }
    const merge = svg('feMerge');
    merge.appendChild(svg('feMergeNode', { in: 'SourceGraphic' }));
    bands.forEach((_, i) => merge.appendChild(svg('feMergeNode', { in: `b${i}band` })));
    filter.appendChild(merge);
    defs.appendChild(filter);
    return { id, bands };
  }

  function setBand(band, block, top, height) {
    block = clamp(Math.round(block), 2, 20);
    top = Math.round(top);
    height = Math.max(0, Math.ceil(height));
    if (block !== band.block) {
      band.dot.setAttribute('x', Math.floor(block / 2));
      band.dot.setAttribute('y', Math.floor(block / 2));
      band.cell.setAttribute('width', block);
      band.cell.setAttribute('height', block);
      band.dilate.setAttribute('radius', block / 2);
      band.block = block;
    }
    if (top !== band.y) { band.mask.setAttribute('y', top); band.y = top; }
    if (height !== band.height) { band.mask.setAttribute('height', height); band.height = height; }
    const regionY = Math.max(0, top - block);
    const regionHeight = height ? height + block * 2 : 0;
    if (regionY !== band.regionY || regionHeight !== band.regionHeight) {
      for (const node of [band.tile, band.samples, band.dilate]) {
        node.setAttribute('x', 0);
        node.setAttribute('y', regionY);
        node.setAttribute('width', band.width);
        node.setAttribute('height', regionHeight);
      }
      band.regionY = regionY;
      band.regionHeight = regionHeight;
    }
  }

  function paintEffect(entry, rect, viewport) {
    const { page } = entry;
    const visible = rect.bottom > viewport.top && rect.top < viewport.bottom;
    const bandSize = Math.min(110, stage.clientHeight * .16, rect.height * .24);
    const leaving = rect.top < viewport.top - 1;
    const entering = rect.top > viewport.bottom - bandSize && rect.top < viewport.bottom;
    if (plain || printing || motion.matches || !visible || (!leaving && !entering && zoomPulse < .01)) {
      page.style.removeProperty('filter');
      return;
    }
    const effect = entry.effect || (entry.effect = createEffect(entry));
    if (zoomPulse > .01) {
      setBand(effect.bands[0], (2 + 18 * zoomPulse) / scale, 0, entry.height);
      effect.bands.slice(1).forEach(band => setBand(band, 2, 0, 0));
    } else {
      const top = (leaving ? viewport.top - rect.top : viewport.bottom - bandSize - rect.top) / scale;
      const size = bandSize / scale / 4;
      const blocks = leaving ? [24, 14, 7, 3] : [3, 7, 14, 24];
      effect.bands.forEach((band, i) => {
        const y = Math.max(0, top + i * size);
        const bottom = Math.min(entry.height, top + (i + 1) * size);
        setBand(band, blocks[i] / scale, y, Math.max(0, bottom - y));
      });
    }
    const value = `url(#${effect.id})`;
    if (page.style.filter !== value) page.style.filter = value;
  }

  /* Following the scroll */

  function setActive(index) {
    if (index === active) return;
    active = index;
    links.forEach((link, i) => {
      link.classList.toggle('active', i === index);
      if (i === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const { page } = entries[index];
    metaTitle.textContent = page.dataset.title || '';
    metaDesc.textContent = page.dataset.desc || '';
    metaCount.textContent = `${pad(index + 1)} / ${pad(entries.length)}`;
    select.value = page.id;
  }

  function update() {
    frame = 0;
    if (printing) return;
    const viewport = stage.getBoundingClientRect();
    const rects = entries.map(entry => entry.slot.getBoundingClientRect());
    const probe = viewport.top + stage.clientHeight * .3;
    const maxScroll = stage.scrollHeight - stage.clientHeight;
    let current = 0;
    rects.forEach((rect, i) => { if (rect.top <= probe) current = i; });
    if (maxScroll > 0 && stage.scrollTop >= maxScroll - 2) current = entries.length - 1;
    setActive(current);
    progress.style.transform = `scaleX(${maxScroll > 0 ? clamp(stage.scrollTop / maxScroll) : 0})`;

    // The hint waits in the gap under the cover while there is room for it there.
    const hidden = stage.scrollTop > 80 || maxScroll <= 2;
    const viewer = stage.parentElement.getBoundingClientRect();
    const nextTop = rects[1]?.top ?? rects[0].bottom + 64;
    const top = (rects[0].bottom + nextTop) / 2 - viewer.top - scrollHint.offsetHeight / 2;
    const inGap = top >= 0 && top + scrollHint.offsetHeight + 8 < viewer.height;
    scrollHint.classList.toggle('at-cover-end', inGap);
    scrollHint.style.top = inGap ? `${top}px` : '';
    scrollHint.classList.toggle('is-hidden', hidden);
    scrollHint.setAttribute('aria-hidden', String(hidden));
    scrollHint.tabIndex = hidden ? -1 : 0;

    entries.forEach((entry, i) => paintEffect(entry, rects[i], viewport));

    // The bar's initials take over once the cover's have dissolved under it.
    if (coverBrand) {
      const mark = coverBrand.getBoundingClientRect();
      const cover = rects[0];
      const band = Math.min(110, stage.clientHeight * .16, cover.height * .24);
      const dissolved = !motion.matches && cover.top < viewport.top && mark.top + mark.height / 2 <= viewport.top + band * .5;
      const visible = dissolved || mark.bottom <= viewport.top || cover.bottom <= viewport.top;
      brand.classList.toggle('visible', visible);
      brand.setAttribute('aria-hidden', String(!visible));
      brand.tabIndex = visible ? 0 : -1;
    }
  }

  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  /* Fitting and zooming */

  // Remembers which page, and how far down it, sits at a fixed height on screen.
  function anchorAtViewport() {
    const viewport = stage.getBoundingClientRect();
    const y = viewport.top + stage.clientHeight * .35;
    let entry = entries[0];
    for (const candidate of entries) {
      if (candidate.slot.getBoundingClientRect().top <= y) entry = candidate;
      else break;
    }
    const rect = entry.slot.getBoundingClientRect();
    return { entry, fraction: (y - rect.top) / Math.max(1, rect.height), screenY: stage.clientHeight * .35, atTop: stage.scrollTop < 1 };
  }

  const sidePadding = () => parseFloat(getComputedStyle(doc).paddingLeft) + parseFloat(getComputedStyle(doc).paddingRight);

  function applyScale(next, anchor) {
    scale = next;
    doc.style.width = `${Math.max(stage.clientWidth, entries[0].width * scale + sidePadding())}px`;
    entries.forEach(entry => {
      entry.slot.style.width = `${entry.width * scale}px`;
      entry.slot.style.height = `${entry.height * scale}px`;
      entry.fit.style.transform = `scale(${scale})`;
    });
    if (anchor) {
      const viewport = stage.getBoundingClientRect();
      const rect = anchor.entry.slot.getBoundingClientRect();
      stage.scrollTop = anchor.atTop ? 0 : stage.scrollTop + rect.top - viewport.top + rect.height * anchor.fraction - anchor.screenY;
    }
    stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
    scheduleUpdate();
  }

  function targetScale() {
    const fitted = clamp((stage.clientWidth - sidePadding()) / entries[0].width, .1, 1);
    if (plain) return fitted;
    return expanded ? Math.max(.95, fitted * 1.4) : fitted * .9;
  }

  function fit() {
    if (printing) return;
    cancelAnimationFrame(zoomFrame);
    zoomFrame = 0;
    zoomPulse = 0;
    applyScale(targetScale(), anchorAtViewport());
  }

  function toggleZoom() {
    if (plain || printing || DHC.intro.isOpen()) return;
    cancelAnimationFrame(zoomFrame);
    expanded = !expanded;
    const label = expanded ? 'Zoom out' : 'Zoom in';
    zoomButton.setAttribute('aria-label', label);
    zoomButton.setAttribute('aria-pressed', String(expanded));
    zoomButton.title = `${label} (Z)`;

    const anchor = anchorAtViewport();
    const from = scale;
    const to = targetScale();
    const start = performance.now();
    (function animate(now) {
      const t = motion.matches ? 1 : clamp((now - start) / 320);
      zoomPulse = motion.matches ? 0 : Math.sin(t * Math.PI);
      applyScale(from + (to - from) * t * t * (3 - 2 * t), anchor);
      if (t < 1) {
        zoomFrame = requestAnimationFrame(animate);
      } else {
        zoomFrame = 0;
        zoomPulse = 0;
        scheduleUpdate();
      }
    })(start);
  }

  function navigate(id, smooth = true, remember = true) {
    const entry = entries.find(item => item.page.id === id);
    if (!entry) return;
    if (zoomFrame) fit();
    const top = stage.scrollTop + entry.slot.getBoundingClientRect().top - stage.getBoundingClientRect().top - 24;
    stage.scrollTo({ top: Math.max(0, top), behavior: smooth && !motion.matches ? 'smooth' : 'auto' });
    if (remember) history.replaceState(history.state, '', `#${encodeURIComponent(id)}`);
    scheduleUpdate();
  }

  links.forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(decodeURIComponent(link.hash.slice(1)));
  }));
  select.addEventListener('change', () => navigate(select.value));
  zoomButton.addEventListener('click', toggleZoom);
  scrollHint.addEventListener('click', () => navigate(entries[1]?.page.id || entries[0].page.id));

  // A click on a page zooms, unless it was only letting go of selected text.
  let droppingSelection = false;
  window.addEventListener('pointerdown', () => {
    const selection = getSelection();
    droppingSelection = !!selection && !selection.isCollapsed;
  }, { capture: true, passive: true });
  stage.addEventListener('click', event => {
    if (droppingSelection || event.target.closest('a, button, input, select, textarea, [role="button"], .allow-select')) return;
    if (event.target.closest('.page, .page-fit')) toggleZoom();
  });
  document.addEventListener('keydown', event => {
    if (DHC.intro.isOpen() || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.target.closest('input, textarea, select')) return;
    if (event.key.toLowerCase() === 'z' || (event.key === 'Escape' && expanded)) {
      event.preventDefault();
      toggleZoom();
    }
  });

  stage.addEventListener('scroll', scheduleUpdate, { passive: true });
  let lastWidth = 0;
  let lastHeight = 0;
  new ResizeObserver(() => {
    const { width, height } = stage.getBoundingClientRect();
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    fit();
  }).observe(stage);
  motion.addEventListener('change', fit);
  window.addEventListener('hashchange', () => navigate(decodeURIComponent(location.hash.slice(1)), false, false));
  window.addEventListener('pageshow', scheduleUpdate);
  DHC.designFontsReady.then(scheduleUpdate);

  /* Printing: every image loaded, every page at its true size */

  const loadAllImages = () => Array.from(doc.querySelectorAll('img')).map(image => { image.loading = 'eager'; return image; });
  let printPosition = null;
  window.exportPortfolioToPdf = window.downloadPortfolioPDF = async () => {
    const images = loadAllImages();
    await Promise.allSettled(images.map(image => image.decode()));
    await DHC.designFontsReady;
    if (images.some(image => !image.naturalWidth)) throw new Error('Portfolio images must load before exporting.');
    window.print();
  };
  window.addEventListener('beforeprint', () => {
    printPosition = { top: stage.scrollTop, left: stage.scrollLeft };
    printing = true;
    cancelAnimationFrame(zoomFrame);
    zoomPulse = 0;
    loadAllImages();
    entries.forEach(entry => entry.page.style.removeProperty('filter'));
  });
  window.addEventListener('afterprint', () => {
    printing = false;
    fit();
    if (printPosition) stage.scrollTo(printPosition);
  });

  fit();
  if (location.hash) navigate(decodeURIComponent(location.hash.slice(1)), false, false);
  update();
})();
