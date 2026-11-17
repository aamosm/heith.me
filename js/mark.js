// Draws the signature as the tab icon and for the loader.
(function () {
  'use strict';

  const DHC = window.DHC;
  const ICON = 64;
  const MARGIN = 4;
  const OVERSAMPLE = 4;
  const WEIGHT = 1.4;
  const scheme = matchMedia('(prefers-color-scheme: dark)');

  // assets/signature.webp is already trimmed to its ink.
  const image = new Image();
  const ready = new Promise(resolve => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  image.src = new URL('assets/signature.webp', DHC.base).href;

  const strokes = {};
  let shown = false;

  // The pen line is too fine at icon size, so it is thickened and hardened into one flat colour.
  function strokeCanvas(size, dark) {
    const key = size + (dark ? 'd' : 'l');
    if (strokes[key]) return strokes[key];

    const unit = size / ICON;
    const side = size * OVERSAMPLE;
    const room = size - MARGIN * unit * 2;
    const fit = Math.min(room / image.naturalWidth, room / image.naturalHeight) * OVERSAMPLE;
    const width = image.naturalWidth * fit;
    const height = image.naturalHeight * fit;

    const mask = document.createElement('canvas');
    mask.width = mask.height = side;
    const maskCtx = mask.getContext('2d');
    maskCtx.imageSmoothingQuality = 'high';
    maskCtx.drawImage(image, (side - width) / 2, (side - height) / 2 + 2 * unit * OVERSAMPLE, width, height);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const radius = WEIGHT * unit * OVERSAMPLE;
    const steps = Math.max(8, Math.ceil(radius * 8));
    for (let i = 0; i < steps; i++) {
      const angle = Math.PI * 2 * i / steps;
      ctx.drawImage(mask, Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.drawImage(mask, 0, 0);

    const pixels = ctx.getImageData(0, 0, side, side);
    const data = pixels.data;
    const value = dark ? 255 : 0;
    for (let p = 0; p < data.length; p += 4) {
      const solid = data[p + 3] > 30;
      data[p] = data[p + 1] = data[p + 2] = value;
      data[p + 3] = solid ? 255 : 0;
    }
    ctx.putImageData(pixels, 0, 0);
    return (strokes[key] = canvas);
  }

  function render(canvas, { dark = scheme.matches, scale = 1 } = {}) {
    if (!image.naturalWidth) return false;
    const size = canvas.width;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, size, size);
    const drawn = size * scale;
    ctx.globalAlpha = Math.min(1, scale);
    ctx.drawImage(strokeCanvas(size, dark), (size - drawn) / 2, (size - drawn) / 2, drawn, drawn);
    ctx.globalAlpha = 1;
    return true;
  }

  function setIcon(dark = scheme.matches, scale = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ICON;
    if (!render(canvas, { dark, scale })) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
    shown = true;
  }

  // The icon pops into the tab with a small overshoot.
  function popIcon(dark = scheme.matches) {
    const STEPS = 16;
    let i = 0;
    (function step() {
      const t = i / (STEPS - 1);
      setIcon(dark, i === STEPS - 1 ? 1 : Math.max(.001, 1 - Math.exp(-6 * t) * Math.cos(9 * t)));
      if (++i < STEPS) setTimeout(step, 800 / (STEPS - 1));
    })();
  }

  const mark = DHC.mark = {
    ready,
    render,
    hold: false,
    show: () => ready.then(ok => { if (ok) setIcon(); }),
    pop: () => ready.then(ok => { if (ok) popIcon(); })
  };

  scheme.addEventListener('change', () => {
    if (shown && !mark.hold) setIcon();
  });
})();
