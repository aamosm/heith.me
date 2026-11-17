// Paints the fibres seen along torn paper edges. Made once, kept for later visits.
(function () {
  'use strict';

  const KEY = 'dhc-paper-fibre-v2';
  const SIZE = 300;
  const root = document.documentElement;
  const use = url => root.style.setProperty('--fibre', `url("${url}")`);

  try {
    const kept = localStorage.getItem(KEY);
    if (kept && kept.startsWith('data:image/')) { use(kept); return; }
  } catch (_) { /* storage can be blocked; paint a fresh one */ }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rand = (min, max) => min + Math.random() * (max - min);

  // Anything near an edge is drawn again on the far side, so the tile repeats without a seam.
  function tiled(x, y, reach, draw) {
    for (const dx of [0, x < reach ? SIZE : x > SIZE - reach ? -SIZE : null]) {
      if (dx === null) continue;
      for (const dy of [0, y < reach ? SIZE : y > SIZE - reach ? -SIZE : null]) {
        if (dy !== null) draw(x + dx, y + dy);
      }
    }
  }

  function blotches(count, minR, maxR, rgb, alpha) {
    for (let i = 0; i < count; i++) {
      const r = rand(minR, maxR);
      tiled(rand(0, SIZE), rand(0, SIZE), r, (x, y) => {
        const fade = ctx.createRadialGradient(x, y, 0, x, y, r);
        fade.addColorStop(0, `rgba(${rgb}, ${alpha})`);
        fade.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = fade;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  ctx.fillStyle = getComputedStyle(root).getPropertyValue('--fray').trim() || '#e8e6df';
  ctx.fillRect(0, 0, SIZE, SIZE);
  blotches(400, 10, 40, '160, 150, 135', .15);
  blotches(300, 5, 25, '255, 255, 255', .25);

  // Short fibres, then a few longer curled ones with a faint shadow.
  for (let i = 0; i < 10000; i++) {
    const length = rand(1, 3);
    const turn = rand(0, Math.PI * 2);
    ctx.strokeStyle = Math.random() > .45 ? 'rgba(255, 255, 255, .6)' : 'rgba(130, 120, 110, .35)';
    ctx.lineWidth = rand(.5, 1);
    tiled(rand(0, SIZE), rand(0, SIZE), 3, (x, y) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(turn) * length, y + Math.sin(turn) * length);
      ctx.stroke();
    });
  }
  ctx.shadowColor = 'rgba(100, 90, 80, .15)';
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = ctx.shadowOffsetY = .5;
  for (let i = 0; i < 1200; i++) {
    const length = rand(3, 9);
    const turn = rand(0, Math.PI * 2);
    ctx.strokeStyle = Math.random() > .5 ? 'rgba(255, 255, 255, .8)' : 'rgba(120, 110, 100, .4)';
    ctx.lineWidth = rand(.8, 1.2);
    tiled(rand(0, SIZE), rand(0, SIZE), 9, (x, y) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(turn + .5) * length * .5, y + Math.sin(turn + .5) * length * .5,
        x + Math.cos(turn) * length, y + Math.sin(turn) * length
      );
      ctx.stroke();
    });
  }

  const url = canvas.toDataURL('image/jpeg', .86);
  use(url);
  try { localStorage.setItem(KEY, url); } catch (_) { /* fine, it is repainted next time */ }
})();
