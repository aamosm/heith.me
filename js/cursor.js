// A soft blob that trails the pointer. Behaviour adapted from Xenobiota by tol-is.
(function () {
  'use strict';

  const root = document.documentElement;
  const blob = document.createElement('div');
  blob.id = 'cursor';
  blob.setAttribute('aria-hidden', 'true');
  document.body.appendChild(blob);

  const TARGETS = 'a, button, [role="button"], input, textarea, select, label, summary, .reel:not(.is-full)';
  const FOLLOW = .0432;
  const pointer = { x: 0, y: 0, active: false, down: false };
  let x = 0;
  let y = 0;
  let angle = 0;
  let frame = 0;
  let last = 0;
  let hovering = false;

  function setHover(target) {
    const on = target instanceof Element && !!target.closest(TARGETS);
    if (on === hovering) return;
    hovering = on;
    blob.classList.toggle('is-hover', on);
  }

  function wake() {
    if (!frame && pointer.active && !document.hidden) frame = requestAnimationFrame(follow);
  }

  function show(event) {
    if (!pointer.active) {
      pointer.active = true;
      x = event.clientX;
      y = event.clientY;
      last = 0;
      root.classList.add('has-cursor');
      blob.style.opacity = '1';
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    setHover(event.target);
    wake();
  }

  function hide() {
    if (!pointer.active) return;
    pointer.active = pointer.down = false;
    root.classList.remove('has-cursor');
    blob.style.opacity = '0';
    cancelAnimationFrame(frame);
    frame = 0;
  }

  // Timed by the clock, so the trail feels the same on a 60 Hz and a 144 Hz screen.
  function follow(now) {
    frame = 0;
    if (!pointer.active) return;
    const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 60;
    last = now;

    const dx = pointer.x - x;
    const dy = pointer.y - y;
    const settled = Math.abs(dx) < .01 && Math.abs(dy) < .01;
    const ease = settled ? 1 : 1 - Math.exp(-dt / FOLLOW);
    const stepX = dx * ease;
    const stepY = dy * ease;
    x += stepX;
    y += stepY;

    const speed = Math.hypot(stepX, stepY) / (dt * 60);
    const stretch = Math.min(.9, speed * .05);
    if (speed > .05) angle = Math.atan2(stepY, stepX) * 180 / Math.PI;
    const size = pointer.down ? .6 : 1;
    blob.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${angle.toFixed(1)}deg) ` +
      `scale(${(size * (1 + stretch)).toFixed(3)}, ${(size * (1 - stretch * .6)).toFixed(3)})`;

    if (settled) last = 0;
    else frame = requestAnimationFrame(follow);
  }

  const outside = event => event.clientX <= 0 || event.clientY <= 0 ||
    event.clientX >= root.clientWidth || event.clientY >= root.clientHeight;

  addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || outside(event)) hide();
    else show(event);
  }, { passive: true });
  addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') { hide(); return; }
    show(event);
    pointer.down = true;
  }, { passive: true });
  ['pointerup', 'pointercancel'].forEach(type => addEventListener(type, () => {
    pointer.down = false;
    wake();
  }, { passive: true }));

  // Catches what moves under a still pointer: scrolling, a sheet closing.
  document.addEventListener('mouseover', event => { if (pointer.active) setHover(event.target); }, { passive: true });
  document.addEventListener('mouseout', event => { if (!event.relatedTarget) hide(); }, { passive: true });
  document.addEventListener('mouseleave', hide);
  addEventListener('blur', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
})();
