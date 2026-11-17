// The landing scene: paper panels that draw back over the reel as you scroll.
(function () {
  'use strict';

  const DHC = window.DHC;
  const root = document.documentElement;
  const vars = root.style;
  const body = document.body;
  const spacer = document.getElementById('spacer');
  const reel = document.getElementById('reel');
  const video = reel.querySelector('video');
  const deskLinks = Array.from(document.querySelectorAll('.desk-s-text'));
  const phoneLinks = Array.from(document.querySelectorAll('.mobile-s-text'));
  const phoneHero = document.getElementById('mobileHeroCopy');
  const phoneHint = document.getElementById('mobileScrollHint');
  const phoneControls = document.getElementById('mobileReelControls');
  const topBrand = document.querySelector('#panel-top .brand');
  const rightBase = document.getElementById('panel-right-base');
  const panels = {
    top: [document.getElementById('panel-top')],
    bottom: [document.getElementById('panel-bottom')],
    left: [document.getElementById('panel-left')],
    right: [rightBase, document.getElementById('panel-right-fake')]
  };
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // Springs. The reel window follows the scroll tightly, the paper a little behind it.
  const REEL = { tension: 280, friction: 26 };
  const PAPER = { tension: 120, friction: 16 };
  // A dragged panel springs back like this.
  const RETURN = { tension: 210, damping: 12 };
  RETURN.frequency = Math.sqrt(RETURN.tension - RETURN.damping ** 2);
  const SPLIT_CLEARANCE = 48;
  const GRIP_DELAY = 150;
  const GRIP_SLOP = 8;

  let vw = 0;
  let vh = 0;
  let phone = false;
  let rest = null;
  let restEdges = { top: 0, bottom: 0, left: 0, right: 0 };
  let openEdges = { top: 0, bottom: 0, left: 0, right: 0 };
  let pinRange = 0;

  let started = false;   // the opening move has played, scroll now drives the scene
  let leaving = false;   // on the way out to the repository
  let looping = false;
  let lastTick = 0;
  let target = 0;
  let reelP = 0;
  let reelV = 0;
  let paperP = 0;
  let paperV = 0;

  /* Layout */

  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    phone = vw < 760 || vh < 480;
    body.classList.toggle('mobile-mode', phone);

    if (phone) {
      const top = Math.min(phoneHero.getBoundingClientRect().bottom + 24, vh * .55);
      rest = { left: 20, top, width: vw - 40, height: Math.max(220, vh - top - 28), radius: 22 };
      openEdges = { top: 0, bottom: 0, left: 0, right: 0 };
    } else {
      reel.style.clipPath = '';
      const width = clamp(.34 * vw, 320, 620);
      const height = .6 * vh;
      // The window never slides under the initials in the top panel.
      const left = Math.max(vw - width - .08 * vw, topBrand.getBoundingClientRect().right + 8);
      rest = { left, top: (vh - height) / 2, width, height, radius: 0 };
      openEdges = { top: 100, bottom: 20, left: 20, right: 48 };
      vars.setProperty('--rest-left', rest.left + 'px');
      vars.setProperty('--rest-top', rest.top + 'px');
      vars.setProperty('--rest-bottom', (vh - rest.top - rest.height) + 'px');
    }

    restEdges = {
      top: rest.top,
      bottom: vh - rest.top - rest.height,
      left: rest.left,
      right: vw - rest.left - rest.width + (phone ? 0 : 18)
    };
    pinRange = spacer.offsetHeight - vh;
    sceneKey = null;
  }

  /* Dragging a panel: hold, pull, let go */

  const pull = Object.fromEntries(Object.keys(panels).map(edge => [edge, { offset: 0, velocity: 0 }]));
  let drag = null;
  let swallowClick = false;

  function settlePulls(dt) {
    let settled = true;
    const decay = Math.exp(-RETURN.damping * dt);
    const cos = Math.cos(RETURN.frequency * dt);
    const sin = Math.sin(RETURN.frequency * dt) / RETURN.frequency;
    for (const [edge, p] of Object.entries(pull)) {
      if (drag?.edge === edge && drag.armed) continue;
      if (calm.matches || (Math.abs(p.offset) < .05 && Math.abs(p.velocity) < .1)) {
        p.offset = p.velocity = 0;
        continue;
      }
      const { offset, velocity } = p;
      p.offset = decay * (offset * cos + (velocity + RETURN.damping * offset) * sin);
      p.velocity = decay * (velocity * cos - (RETURN.damping * velocity + RETURN.tension * offset) * sin);
      settled = false;
    }
    return settled;
  }

  function endDrag(cancelled = false) {
    if (!drag) return;
    const ended = drag;
    drag = null;
    clearTimeout(ended.timer);
    if (ended.panel.hasPointerCapture(ended.id)) ended.panel.releasePointerCapture(ended.id);
    // A flick carries on; a pause before letting go does not.
    if (ended.armed) pull[ended.edge].velocity *= cancelled ? 0 : Math.exp(-Math.max(0, performance.now() - ended.time - 32) / 60);
    swallowClick = ended.moved && !cancelled;
    wake();
  }

  const notDraggable = 'a, button, input, textarea, select, [role="button"], .allow-select, .scroll-hint';
  for (const [edge, group] of Object.entries(panels)) {
    group.forEach(panel => panel.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || drag || !started || leaving || phone) return;
      if (event.target.closest(notDraggable) || DHC.intro.isOpen()) return;
      const grip = drag = {
        edge, panel, id: event.pointerId,
        x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY,
        from: pull[edge].offset, time: performance.now(), moved: false, armed: false, timer: 0
      };
      // It only takes hold after a short press, so a quick click or a scroll passes through.
      grip.timer = setTimeout(() => {
        if (drag !== grip) return;
        grip.armed = true;
        grip.x = grip.lastX;
        grip.y = grip.lastY;
        grip.from = pull[edge].offset;
        grip.time = performance.now();
        pull[edge].velocity = 0;
      }, GRIP_DELAY);
      panel.setPointerCapture(event.pointerId);
    }));
  }

  document.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.armed) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > GRIP_SLOP) endDrag(true);
      return;
    }
    const sideways = drag.edge === 'left' || drag.edge === 'right';
    const delta = sideways ? event.clientX - drag.x : event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(delta) < 3) return;
      drag.moved = true;
    }
    const inward = drag.edge === 'bottom' || drag.edge === 'right' ? -1 : 1;
    const next = drag.from + inward * delta;
    const now = performance.now();
    const elapsed = Math.max(.001, (now - drag.time) / 1000);
    const p = pull[drag.edge];
    p.velocity = lerp(p.velocity, clamp((next - p.offset) / elapsed, -1400, 1400), 1 - Math.exp(-elapsed / .04));
    p.offset = next;
    drag.time = now;
    wake();
  }, { passive: true });
  document.addEventListener('pointerup', event => { if (drag?.id === event.pointerId) endDrag(); });
  ['pointercancel', 'lostpointercapture'].forEach(type => {
    document.addEventListener(type, event => { if (drag?.id === event.pointerId) endDrag(true); });
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') endDrag(true); });
  window.addEventListener('blur', () => endDrag(true));

  // Letting go of a dragged panel must not also click whatever is under it.
  document.addEventListener('pointerdown', () => { swallowClick = false; }, { capture: true, passive: true });
  document.addEventListener('click', event => {
    if (!swallowClick || event.detail === 0) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });

  /* Painting a frame */

  // The further a panel is pulled, the harder it resists.
  function pulled(edge, base, room) {
    const { offset } = pull[edge];
    const available = offset < 0 ? Math.max(0, base - 12) : Math.max(0, room);
    const range = edge === 'right' ? Math.min(6, available) : available;
    return range > 0 ? range * offset / (range + Math.abs(offset)) : 0;
  }

  function paintDesktop(edges) {
    const topBase = Math.max(12, edges.top);
    const bottomBase = Math.max(36, edges.bottom);
    const leftBase = Math.max(36, edges.left);
    const rightEdge = Math.max(84, edges.right);
    const bottomRoom = Math.min(vh * .35, (vh - topBase - 3 * SPLIT_CLEARANCE) / 2 - bottomBase);
    const top = topBase + pulled('top', topBase, vh * .35);
    const bottom = bottomBase + pulled('bottom', bottomBase, bottomRoom);
    vars.setProperty('--p-top', top + 'px');
    vars.setProperty('--p-bottom', bottom + 'px');
    vars.setProperty('--p-left', (leftBase + pulled('left', leftBase, vw * .35)) + 'px');
    vars.setProperty('--p-right', (rightEdge + pulled('right', rightEdge, vw * .35)) + 'px');
    // The cut between the two halves of the right panel stays hidden between top and bottom.
    vars.setProperty('--split-y', Math.min((2 * vh + top - bottom) / 3, vh - bottom - SPLIT_CLEARANCE) + 'px');
  }

  // Links fade in one after another near the end of the scroll.
  const LINK_WINDOWS = [[.50, .68], [.60, .80], [.72, .92]];

  function paintPhone(r, p) {
    const right = vw - (r.left + r.width);
    const bottom = vh - (r.top + r.height);
    reel.style.clipPath = `inset(${r.top}px ${right}px ${bottom}px ${r.left}px round ${r.radius}px)`;
    phoneControls.style.left = (r.left + 20) + 'px';
    phoneControls.style.top = (r.top + r.height - 44) + 'px';
    phoneControls.style.opacity = '1';

    const mid = r.top + r.height * .45;
    const gap = clamp(vh * .12, 60, 100);
    const tops = [Math.max(mid - gap, 104), mid, mid + gap];
    phoneLinks.forEach((link, i) => {
      const [from, to] = LINK_WINDOWS[i];
      const t = clamp((p - from) / (to - from), 0, 1);
      link.style.left = (r.left + 28) + 'px';
      link.style.top = tops[i] + 'px';
      link.style.opacity = String(t);
      link.style.transform = `translateY(${16 * (1 - t)}px)`;
      link.style.pointerEvents = t > .02 ? 'auto' : 'none';
    });
  }

  const edgesAt = p => ({
    top: lerp(restEdges.top, openEdges.top, p),
    bottom: lerp(restEdges.bottom, openEdges.bottom, p),
    left: lerp(restEdges.left, openEdges.left, p),
    right: lerp(restEdges.right, openEdges.right, p)
  });

  function paint(p, panelP) {
    if (phone) {
      const e = edgesAt(p);
      paintPhone({ left: e.left, top: e.top, width: vw - e.left - e.right, height: vh - e.top - e.bottom, radius: lerp(rest.radius, 0, p) }, p);
      phoneHero.style.opacity = String(clamp(1 - p / .35, 0, 1));
      phoneHint.style.opacity = p > .02 ? '0' : '1';
    } else {
      paintDesktop(edgesAt(panelP));
    }
    reel.classList.toggle('is-full', p > .995);
  }

  function tick(now) {
    if (leaving) { looping = false; return; }
    const dt = Math.min((now - (lastTick || now)) / 1000, .05);
    lastTick = now;

    reelV += (REEL.tension * (target - reelP) - REEL.friction * reelV) * dt;
    reelP += reelV * dt;
    paperV += (PAPER.tension * (target - paperP) - PAPER.friction * paperV) * dt;
    paperP += paperV * dt;

    const reelDone = Math.abs(target - reelP) < .0002 && Math.abs(reelV) < .001;
    const paperDone = Math.abs(target - paperP) < .0002 && Math.abs(paperV) < .001;
    if (reelDone) { reelP = target; reelV = 0; }
    if (paperDone) { paperP = target; paperV = 0; }
    const pullsDone = settlePulls(dt);

    paint(reelP, paperP);

    if (reelDone && paperDone && pullsDone) {
      looping = false;
      lastTick = 0;
    } else {
      requestAnimationFrame(tick);
    }
  }

  // The loop only runs while something is still moving.
  function wake() {
    if (looping) return;
    looping = true;
    lastTick = 0;
    requestAnimationFrame(tick);
  }

  const progress = () => (pinRange > 0 ? clamp(window.scrollY / pinRange, 0, 1) : 0);

  function onScroll() {
    if (!started || leaving) return;
    target = progress();
    wake();
  }
  function snapToScroll() {
    target = reelP = paperP = progress();
    reelV = paperV = 0;
    paint(reelP, paperP);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      endDrag(true);
      Object.values(pull).forEach(p => { p.offset = p.velocity = 0; });
      measure();
      if (started) onScroll();
      paint(reelP, paperP);
      paintLinks(video.currentTime);
    });
  });

  /* Scrolling by click */

  const lenis = DHC.smoothScroll({
    lerp: .1,
    wheelMultiplier: 1,
    touchMultiplier: 1.15,
    gestureOrientation: 'vertical',
    smoothWheel: true,
    syncTouch: false,
    anchors: true
  });

  function scrollTo(y, ms) {
    if (lenis) {
      lenis.scrollTo(y, { duration: ms / 1000, easing: smooth });
      return;
    }
    const from = window.scrollY;
    const t0 = performance.now();
    (function step(now) {
      const t = clamp((now - t0) / ms, 0, 1);
      window.scrollTo(0, lerp(from, y, smooth(t)));
      if (t < 1) requestAnimationFrame(step);
    })(t0);
  }

  document.querySelectorAll('.scroll-hint').forEach(hint => hint.addEventListener('click', () => {
    if (pinRange > 0) scrollTo(clamp(window.scrollY + vh * .85, 0, pinRange), 650);
  }));

  // Clicking the window opens it all the way, unless the click was only letting go of selected text.
  let droppingSelection = false;
  window.addEventListener('pointerdown', () => {
    const selection = getSelection();
    droppingSelection = !!selection && !selection.isCollapsed;
  }, { capture: true, passive: true });
  reel.addEventListener('click', () => {
    if (droppingSelection || !started || pinRange <= 0 || target >= .995) return;
    scrollTo(pinRange, 650);
  });

  /* Opening move: the window starts a little small and settles out to its resting size */

  function openScene() {
    measure();
    const w = rest.width * .86;
    const h = rest.height * .86;
    const small = { left: rest.left + (rest.width - w) / 2, top: rest.top + (rest.height - h) / 2, width: w, height: h, radius: rest.radius };
    const begin = () => { started = true; onScroll(); };

    if (phone) {
      paintPhone(small, 0);
      reel.style.transition = 'none';
      reel.style.opacity = '0';
      void reel.offsetWidth;
      requestAnimationFrame(() => {
        reel.style.transition = 'clip-path .9s cubic-bezier(.16, 1, .3, 1), opacity .6s ease';
        reel.style.opacity = '1';
        paintPhone(rest, 0);
      });
      setTimeout(() => { reel.style.transition = 'none'; begin(); }, 950);
      return;
    }

    paintDesktop({ top: small.top, bottom: vh - small.top - small.height, left: small.left, right: vw - small.left - small.width });
    void panels.top[0].offsetHeight;
    requestAnimationFrame(() => {
      root.classList.add('panel-anim');
      paintDesktop(restEdges);
    });
    setTimeout(() => { root.classList.remove('panel-anim'); begin(); }, 950);
  }

  /* Reel controls */

  const playButtons = document.querySelectorAll('.play-btn');
  const muteButtons = document.querySelectorAll('.mute-btn');

  function label(buttons, attribute, state, text) {
    buttons.forEach(button => {
      button.dataset[attribute] = String(state);
      button.setAttribute('aria-label', text);
      button.title = text;
    });
  }
  function syncControls() {
    label(playButtons, 'playing', !video.paused, video.paused ? 'Play video' : 'Pause video');
    label(muteButtons, 'muted', video.muted, video.muted ? 'Unmute video' : 'Mute video');
  }

  let fade = 0;
  function fadeVolume(to, ms, then) {
    cancelAnimationFrame(fade);
    const from = video.volume;
    const t0 = performance.now();
    (function step(now) {
      const t = Math.min((now - t0) / ms, 1);
      video.volume = from + (to - from) * t;
      if (t < 1) fade = requestAnimationFrame(step);
      else if (then) then();
    })(t0);
  }

  playButtons.forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }));
  let muting = false;
  muteButtons.forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    if (video.muted || muting) {
      muting = false;
      if (video.muted) video.volume = 0;
      video.muted = false;
      fadeVolume(1, 500);
      syncControls();
    } else {
      // The button flips at once; the sound takes half a second to follow.
      muting = true;
      label(muteButtons, 'muted', true, 'Unmute video');
      fadeVolume(0, 500, () => {
        video.muted = true;
        video.volume = 1;
        muting = false;
      });
    }
  }));
  ['play', 'pause'].forEach(type => video.addEventListener(type, syncControls));
  video.addEventListener('volumechange', () => { if (!muting) syncControls(); });
  syncControls();

  let wasPlaying = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasPlaying = !video.paused;
      video.pause();
    } else if (wasPlaying) {
      if (video.muted) { video.play().catch(() => {}); return; }
      video.volume = 0;
      video.play().then(() => fadeVolume(1, 1000)).catch(() => {});
    }
  });

  /* Link colours, cut to the reel */

  const INK = '#15101f';
  const SHEET = '#f5f0e8';
  const RED = '#ff4d3d';
  const CYAN = '#1fd0e6';
  const SUN = '#ffc533';
  const ICE = '#14e2ff';

  // From each time on: the fill of Projects, Design and Devlogs, then the two offset colours.
  // Ink where the footage behind is light, paper where it is dark.
  const SCENES = [
    { t: 0,      fill: [INK, INK, INK],          edges: [RED, CYAN] },          // wide shot, pale sky
    { t: 6.25,   fill: [SHEET, SHEET, SHEET],    edges: [RED, CYAN] },          // close on the boy, dark
    { t: 8.2,    fill: [INK, INK, INK],          edges: [SUN, CYAN] },          // running under a lavender sky
    { t: 13.833, fill: [INK, INK, INK],          edges: [RED, CYAN] },          // wide shot again
    { t: 16.583, fill: [INK, INK, INK],          edges: [SUN, CYAN] },          // running
    { t: 21.875, fill: [SHEET, SHEET, SHEET],    edges: [RED, CYAN] },          // stalks against black
    { t: 22.75,  fill: ['#ecd078', '#ecd078', '#ecd078'], edges: [RED, SHEET] }, // black screen
    { t: 25.042, fill: ['#fff', '#fff', '#fff'], edges: [ICE, '#2a36ff'] },     // the field burns orange
    { t: 26.292, fill: [SHEET, SHEET, SHEET],    edges: ['#b9ff3b', ICE] },     // magenta haze
    { t: 28.708, fill: [INK, SHEET, SHEET],      edges: [RED, CYAN] }           // the two of them: sky above, field below
  ];
  // On a phone the links sit over the middle of the frame, where the boy runs past them.
  const PHONE_SCENES = SCENES.map(scene => (scene.t === 8.2 ? { ...scene, t: 9.25 } : scene)).concat([
    { t: 18.2, fill: [SHEET, SHEET, SHEET], edges: [SUN, CYAN] },
    { t: 19.8, fill: [INK, INK, INK], edges: [SUN, CYAN] }
  ]).sort((a, b) => a.t - b.t);
  // Frame callbacks arrive about a frame late, so cuts are anticipated by that much.
  const LEAD = .03;

  let sceneKey = null;
  function paintLinks(time) {
    const scenes = phone ? PHONE_SCENES : SCENES;
    let scene = scenes[0];
    for (const next of scenes) {
      if (next.t <= time + LEAD) scene = next;
      else break;
    }
    if (scene === sceneKey) return;
    sceneKey = scene;
    scene.fill.forEach((colour, i) => vars.setProperty(`--s-fill-${i + 1}`, colour));
    vars.setProperty('--s-a', scene.edges[0]);
    vars.setProperty('--s-b', scene.edges[1]);
  }

  if ('requestVideoFrameCallback' in video) {
    const onFrame = (_, frame) => {
      paintLinks(frame.mediaTime);
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  } else {
    (function poll() {
      if (!video.paused && !document.hidden) paintLinks(video.currentTime);
      requestAnimationFrame(poll);
    })();
  }
  paintLinks(0);

  deskLinks.forEach(link => {
    link.addEventListener('mousemove', event => {
      const box = link.getBoundingClientRect();
      link.style.setProperty('--hx', String(((event.clientX - box.left) / box.width - .5) * 2));
      link.style.setProperty('--hy', String(((event.clientY - box.top) / box.height - .5) * 2));
    });
    link.addEventListener('mouseleave', () => {
      link.style.setProperty('--hx', '0');
      link.style.setProperty('--hy', '0');
    });
  });

  /* Leaving for the repository: the paper is pushed off and the right panel takes the screen */

  const PUSH = 1050;
  const TAKEOVER = 820;
  const OVERLAP = .45;
  const OVERSHOOT = 80;
  const shot = new URL('assets/landing/repository.webp', DHC.base).href;
  let leaveFrame = 0;

  function leaveFor(dest) {
    leaving = true;
    endDrag(true);
    lenis?.stop();
    body.style.overflow = 'hidden';

    const read = name => parseFloat(vars.getPropertyValue(name));
    const from = { top: read('--p-top') || restEdges.top, bottom: read('--p-bottom') || restEdges.bottom, left: read('--p-left') || restEdges.left };
    const t0 = performance.now();
    let takeover = 0;
    let fromRight = 0;

    (function step(now) {
      const push = clamp((now - t0) / PUSH, 0, 1) ** 3;
      const top = lerp(from.top, -(vh + OVERSHOOT), push);
      const bottom = lerp(from.bottom, -(vh + OVERSHOOT), push);
      vars.setProperty('--p-top', top + 'px');
      vars.setProperty('--p-bottom', bottom + 'px');
      vars.setProperty('--p-left', lerp(from.left, -(vw + OVERSHOOT), push) + 'px');
      const middle = top + (vh - top - bottom) / 2;
      vars.setProperty('--split-y', (middle + (vh - middle) / 3) + 'px');

      // The right panel sets off before the others have gone.
      if (!takeover && now - t0 > PUSH * OVERLAP) {
        takeover = now;
        fromRight = Math.max(read('--p-right') || restEdges.right, 84);
        rightBase.classList.add('is-taking-over');
      }
      if (takeover) {
        const grow = clamp((now - takeover) / TAKEOVER, 0, 1);
        vars.setProperty('--p-right', lerp(fromRight, vw + OVERSHOOT, grow ** 3) + 'px');
        if (grow >= 1) {
          // Keep the screenshot up until the real page replaces it.
          [body, root].forEach(node => { node.style.background = `url("${shot}") center / cover no-repeat`; });
          leaveFrame = requestAnimationFrame(() => { location.href = dest; });
          return;
        }
      }
      leaveFrame = requestAnimationFrame(step);
    })(t0);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('[data-leave]');
    if (!link || phone || calm.matches) return;
    event.preventDefault();
    if (!leaving) leaveFor(link.href);
  });

  // Coming back with the Back button finds the page mid-exit. Put it back together.
  window.addEventListener('pageshow', event => {
    if (!event.persisted || !leaving) return;
    cancelAnimationFrame(leaveFrame);
    leaving = false;
    rightBase.classList.remove('is-taking-over');
    [body, root].forEach(node => node.style.removeProperty('background'));
    body.style.removeProperty('overflow');
    measure();
    snapToScroll();
    lenis?.start();
    video.play().catch(() => {});
  });

  /* Start */

  measure();
  paint(0, 0);
  // Fonts change the measurements, so the scene is only shown once they are in.
  const sceneReady = DHC.fontsReady.then(() => {
    measure();
    paint(reelP, paperP);
    root.dataset.sceneReady = 'true';
  });

  async function start() {
    await sceneReady;
    video.play().catch(() => {});
    if (window.scrollY > 1 || calm.matches) {
      started = true;
      snapToScroll();
    } else {
      openScene();
    }
  }

  // A direct visit begins once the introduction is dismissed. From inside the site there is nothing to wait for.
  if (!DHC.enter({ onDismiss: start })) {
    started = true;
    snapToScroll();
    sceneReady.then(snapToScroll);
    video.play().catch(() => {});
  }
})();
