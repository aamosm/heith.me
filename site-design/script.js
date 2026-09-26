(() => {
  const root = document.documentElement;
  const site = window.DHCSite = window.DHCSite || {};
  site.designFontsReady = document.fonts ? Promise.allSettled([
    site.fontsReady,
    document.fonts.load('300 14px "Manrope"'),
    document.fonts.load('400 14px "Manrope"'),
    document.fonts.load('500 14px "Manrope"'),
    document.fonts.load('600 14px "Manrope"'),
    document.fonts.load('800 32px "Manrope"'),
    document.fonts.load('100 12px "JetBrains Mono"'),
    document.fonts.load('400 12px "JetBrains Mono"'),
    document.fonts.load('500 12px "JetBrains Mono"'),
    document.fonts.load('400 14px "Kalam"'),
    document.fonts.load('700 14px "Kalam"')
  ]).then(() => document.fonts.ready) : Promise.resolve();
  site.designFontsReady.then(() => { root.dataset.designFonts = 'ready'; });
})();

(function () {
    if (document.body.dataset.view !== 'viewer') return;
    const quiet = document.documentElement.dataset.pageEntry === 'quiet';
    const params = new URLSearchParams(location.search);
    if (quiet) {
        document.getElementById('intro-card')?.remove();
        params.delete('v');
        const query = params.toString();
        history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
        if (window.DHCMark) window.DHCMark.ready.then(function (loaded) {
            if (loaded) window.DHCMark.updateFavicon(matchMedia('(prefers-color-scheme: dark)').matches);
        });
        return;
    }
    let resolveAnimation;
    let animationFinished = false;
    let imageWait;
    const animationDone = new Promise(resolve => { resolveAnimation = resolve; });
    const card = window.showIntroOverlay ? window.showIntroOverlay(false, animationDone) : document.getElementById('intro-card');

    function finishAnimation() {
        if (animationFinished) return;
        animationFinished = true;
        clearTimeout(imageWait);
        resolveAnimation();
        if (!window.showIntroOverlay && card) {
            card.removeAttribute('data-entry-intro');
            card.inert = false;
            card.classList.add('text-ready');
        }
    }

    if (!window.DHCMark || !window.DHCGlassLoader) {
        finishAnimation();
        if (window.DHCMark) window.DHCMark.ready.then(function (loaded) {
            if (loaded) window.DHCMark.updateFavicon(matchMedia('(prefers-color-scheme: dark)').matches);
        });
        return;
    }

    imageWait = setTimeout(finishAnimation, 700);
    window.DHCMark.ready.then(function (loaded) {
        clearTimeout(imageWait);
        if (!loaded) { finishAnimation(); return; }
        if (animationFinished || !card?.isConnected || card.classList.contains('exit')) {
            window.DHCMark.updateFavicon(matchMedia('(prefers-color-scheme: dark)').matches);
            finishAnimation();
            return;
        }
        window.DHCGlassLoader.play(finishAnimation);
    }).catch(finishAnimation);
})();

(() => {
  'use strict';

  function init() {
    const stage = document.getElementById('stage-container');
    const doc = document.getElementById('doc');
    if (document.body.dataset.view !== 'viewer' || !stage || !doc) return;

    const pages = Array.from(doc.children).filter(node => node.classList.contains('page'));
    if (!pages.length) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
    const ns = 'http://www.w3.org/2000/svg';
    let scale = 1;
    let expanded = false;
    let active = -1;
    let frame = 0;
    let zoomFrame = 0;
    let zoomPulse = 0;
    let printing = false;
    let resizeWidth = 0;
    let resizeHeight = 0;
    let clearingSelection = false;

    const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
    const pad = n => String(n).padStart(2, '0');
    const svg = (name, attrs = {}) => {
      const node = document.createElementNS(ns, name);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    };
    const filterHost = svg('svg', { class: 'pixel-filters', 'aria-hidden': 'true', focusable: 'false' });
    const defs = svg('defs');
    filterHost.appendChild(defs);
    document.body.appendChild(filterHost);

    const entries = pages.map((page, index) => {
      const width = page.offsetWidth;
      const height = page.offsetHeight;
      const slot = document.createElement('div');
      const fit = document.createElement('div');
      slot.className = 'page-slot';
      fit.className = 'page-fit';
      slot.style.width = `${width}px`;
      slot.style.height = `${height}px`;
      fit.style.width = `${width}px`;
      fit.style.height = `${height}px`;
      page.before(slot);
      slot.appendChild(fit);
      fit.appendChild(page);
      return { page, slot, fit, width, height, index, effect: null };
    });

    function createEffect(entry) {
      const { width, height, index } = entry;
      const id = `page-pixels-${index}`;
      const filter = svg('filter', {
        id, x: 0, y: 0, width, height,
        filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
        'color-interpolation-filters': 'sRGB'
      });
      const bands = [];
      for (let i = 0; i < 4; i++) {
        const prefix = `b${i}`;
        const dot = svg('feFlood', { x: 0, y: 0, width: 1, height: 1, 'flood-color': 'white', result: `${prefix}dot` });
        const cell = svg('feComposite', { in: `${prefix}dot`, in2: `${prefix}dot`, operator: 'over', x: 0, y: 0, width: 4, height: 4, result: `${prefix}cell` });
        const tile = svg('feTile', { in: `${prefix}cell`, x: 0, y: 0, width, height, result: `${prefix}grid` });
        const samples = svg('feComposite', { in: 'SourceGraphic', in2: `${prefix}grid`, operator: 'in', result: `${prefix}samples` });
        const dilate = svg('feMorphology', { in: `${prefix}samples`, operator: 'dilate', radius: 2, result: `${prefix}pixels` });
        const mask = svg('feFlood', { x: 0, y: 0, width, height: 0, 'flood-color': 'white', result: `${prefix}mask` });
        const pixels = svg('feComposite', { in: `${prefix}pixels`, in2: `${prefix}mask`, operator: 'in', result: `${prefix}band` });
        filter.append(dot, cell, tile, samples, dilate, mask, pixels);
        bands.push({ dot, cell, tile, samples, dilate, mask, block: 0, y: -1, height: -1 });
      }
      const output = svg('feMerge');
      output.appendChild(svg('feMergeNode', { in: 'SourceGraphic' }));
      bands.forEach((_, i) => output.appendChild(svg('feMergeNode', { in: `b${i}band` })));
      filter.appendChild(output);
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
          node.setAttribute('width', band.mask.getAttribute('width'));
          node.setAttribute('height', regionHeight);
        }
        band.regionY = regionY;
        band.regionHeight = regionHeight;
      }
    }

    function paintEffect(entry, rect, viewport) {
      const page = entry.page;
      const visible = rect.bottom > viewport.top && rect.top < viewport.bottom;
      const bandSize = Math.min(110, stage.clientHeight * .16, rect.height * .24);
      const leaving = rect.top < viewport.top - 1;
      const entering = rect.top > viewport.bottom - bandSize && rect.top < viewport.bottom;
      if (printing || motion.matches || !visible || (!leaving && !entering && zoomPulse < .01)) {
        page.style.removeProperty('filter');
        return;
      }
      const effect = entry.effect || (entry.effect = createEffect(entry));
      if (zoomPulse > .01) {
        setBand(effect.bands[0], (2 + 18 * zoomPulse) / scale, 0, entry.height);
        effect.bands.slice(1).forEach(band => setBand(band, 2, 0, 0));
      } else {
        const top = leaving ? (viewport.top - rect.top) / scale : (viewport.bottom - bandSize - rect.top) / scale;
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

    function setActive(index) {
      if (index === active) return;
      active = index;
      links.forEach((link, i) => {
        link.classList.toggle('active', i === index);
        if (i === index) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      const page = entries[index].page;
      if (metaTitle) metaTitle.textContent = page.dataset.title || '';
      if (metaDesc) metaDesc.textContent = page.dataset.desc || '';
      if (metaCount) metaCount.textContent = `${pad(index + 1)} / ${pad(entries.length)}`;
      if (select) select.value = page.id;
    }

    function update() {
      frame = 0;
      if (printing) return;
      const viewport = stage.getBoundingClientRect();
      const rects = entries.map(entry => entry.slot.getBoundingClientRect());
      const probe = viewport.top + stage.clientHeight * .3;
      let current = 0;
      rects.forEach((rect, i) => { if (rect.top <= probe) current = i; });
      const maxScroll = stage.scrollHeight - stage.clientHeight;
      if (maxScroll > 0 && stage.scrollTop >= maxScroll - 2) current = entries.length - 1;
      setActive(current);
      if (progress) progress.style.transform = `scaleX(${maxScroll > 0 ? clamp(stage.scrollTop / maxScroll) : 0})`;
      if (scrollHint) {
        const hidden = stage.scrollTop > 80 || maxScroll <= 2;
        const viewer = stage.parentElement.getBoundingClientRect();
        const nextTop = rects[1]?.top ?? rects[0].bottom + 64;
        const top = (rects[0].bottom + nextTop) / 2 - viewer.top - scrollHint.offsetHeight / 2;
        const betweenPages = top >= 0 && top + scrollHint.offsetHeight + 8 < viewer.height;
        scrollHint.classList.toggle('at-cover-end', betweenPages);
        scrollHint.style.top = betweenPages ? `${top}px` : '';
        scrollHint.classList.toggle('is-hidden', hidden);
        scrollHint.setAttribute('aria-hidden', String(hidden));
        scrollHint.tabIndex = hidden ? -1 : 0;
      }
      entries.forEach((entry, i) => paintEffect(entry, rects[i], viewport));

      if (brand && coverBrand) {
        const mark = coverBrand.getBoundingClientRect();
        const cover = rects[0];
        const band = Math.min(110, stage.clientHeight * .16, cover.height * .24);
        const pixelated = !motion.matches && cover.top < viewport.top && mark.top + mark.height / 2 <= viewport.top + band * .5;
        const visible = pixelated || mark.bottom <= viewport.top || cover.bottom <= viewport.top;
        brand.classList.toggle('visible', visible);
        brand.setAttribute('aria-hidden', String(!visible));
        brand.tabIndex = visible ? 0 : -1;
      }
    }

    function scheduleUpdate() {
      if (!frame) frame = requestAnimationFrame(update);
    }

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

    function applyScale(next, anchor) {
      scale = next;
      const padding = parseFloat(getComputedStyle(doc).paddingLeft);
      const width = entries[0].width * scale;
      doc.style.width = `${Math.max(stage.clientWidth, width + padding * 2)}px`;
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
      const padding = parseFloat(getComputedStyle(doc).paddingLeft);
      const fitted = clamp((stage.clientWidth - padding * 2) / entries[0].width, .1, 1);
      return expanded ? Math.max(.95, fitted * 1.4) : fitted * 0.9;
    }

    function fit() {
      if (printing) return;
      cancelAnimationFrame(zoomFrame);
      zoomFrame = 0;
      zoomPulse = 0;
      applyScale(targetScale(), anchorAtViewport());
    }

    function toggleZoom() {
      const intro = document.getElementById('intro-card');
      if (printing || (intro && !intro.classList.contains('exit'))) return;
      cancelAnimationFrame(zoomFrame);
      expanded = !expanded;
      const label = expanded ? 'Zoom out' : 'Zoom in';
      if (zoomButton) {
        zoomButton.setAttribute('aria-label', label);
        zoomButton.setAttribute('aria-pressed', String(expanded));
        zoomButton.title = `${label} (Z)`;
      }
      const anchor = anchorAtViewport();
      const from = scale;
      const to = targetScale();
      const start = performance.now();
      function animate(now) {
        const t = motion.matches ? 1 : clamp((now - start) / 320);
        const eased = t * t * (3 - 2 * t);
        zoomPulse = motion.matches ? 0 : Math.sin(t * Math.PI);
        applyScale(from + (to - from) * eased, anchor);
        if (t < 1) zoomFrame = requestAnimationFrame(animate);
        else { zoomFrame = 0; zoomPulse = 0; scheduleUpdate(); }
      }
      zoomFrame = requestAnimationFrame(animate);
    }

    function navigate(id, smooth = true, remember = true) {
      const entry = entries.find(item => item.page.id === id);
      if (!entry) return;
      if (zoomFrame) {
        cancelAnimationFrame(zoomFrame);
        zoomFrame = 0;
        zoomPulse = 0;
        applyScale(targetScale(), anchorAtViewport());
      }
      const top = stage.scrollTop + entry.slot.getBoundingClientRect().top - stage.getBoundingClientRect().top - 24;
      stage.scrollTo({ top: Math.max(0, top), behavior: smooth && !motion.matches ? 'smooth' : 'auto' });
      if (remember) {
        try { history.replaceState(null, '', `#${encodeURIComponent(id)}`); } catch (_) {  }
      }
      scheduleUpdate();
    }

    links.forEach(link => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(decodeURIComponent(link.hash.slice(1)));
    }));
    if (select) select.addEventListener('change', () => navigate(select.value));
    if (zoomButton) zoomButton.addEventListener('click', toggleZoom);
    if (scrollHint) scrollHint.addEventListener('click', () => navigate(entries[1]?.page.id || entries[0].page.id));
    window.addEventListener('pointerdown', () => {
      const selection = window.getSelection();
      clearingSelection = !!selection && !selection.isCollapsed;
    }, { capture: true, passive: true });
    stage.addEventListener('click', event => {
      if (clearingSelection || event.target.closest('a, button, input, select, textarea, [role="button"], .allow-select')) return;
      if (event.target.closest('.page, .page-fit')) { event.preventDefault(); toggleZoom(); }
    });
    document.addEventListener('keydown', event => {
      const intro = document.getElementById('intro-card');
      if (intro && !intro.classList.contains('exit')) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'z' || (event.key === 'Escape' && expanded)) {
        event.preventDefault();
        toggleZoom();
      }
    });
    stage.addEventListener('scroll', scheduleUpdate, { passive: true });
    const observer = new ResizeObserver(() => {
      const rect = stage.getBoundingClientRect();
      if (rect.width === resizeWidth && rect.height === resizeHeight) return;
      resizeWidth = rect.width;
      resizeHeight = rect.height;
      fit();
    });
    observer.observe(stage);
    motion.addEventListener('change', fit);
    window.addEventListener('hashchange', () => navigate(location.hash.slice(1), false, false));
    window.addEventListener('pageshow', scheduleUpdate);
    window.DHCSite.designFontsReady.then(scheduleUpdate);
    const close = document.querySelector('.close-btn');
    if (close) close.addEventListener('click', () => {
      window.close();
      setTimeout(() => location.assign('../'), 150);
    });

    let printPosition;
    const makeImagesEager = () => Array.from(doc.querySelectorAll('img')).map(image => { image.loading = 'eager'; return image; });
    window.exportPortfolioToPdf = window.downloadPortfolioPDF = async () => {
      const images = makeImagesEager();
      await Promise.allSettled(images.map(image => image.decode()));
      await window.DHCSite.designFontsReady;
      if (images.some(image => !image.naturalWidth)) throw new Error('Portfolio images must load before exporting.');
      window.print();
    };
    window.addEventListener('beforeprint', () => {
      printPosition = { top: stage.scrollTop, left: stage.scrollLeft };
      printing = true;
      cancelAnimationFrame(zoomFrame);
      zoomPulse = 0;
      makeImagesEager();
    });
    window.addEventListener('afterprint', () => {
      printing = false;
      fit();
      if (printPosition) stage.scrollTo(printPosition);
      scheduleUpdate();
    });

    fit();
    if (location.hash) navigate(decodeURIComponent(location.hash.slice(1)), false, false);
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();



