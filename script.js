(function(){
  const docStyle = document.documentElement.style;
  document.getElementById('copyright-year').textContent = new Date().getFullYear();
  const spacerEl  = document.getElementById('spacer');
  const reel      = document.getElementById('reel');
  const video     = reel ? reel.querySelector('video') : null;

  const mTexts    = Array.prototype.slice.call(document.querySelectorAll('.mobile-s-text'));
  const dTexts    = Array.prototype.slice.call(document.querySelectorAll('.desk-s-text'));

  dTexts.forEach(function(el) {
    el.addEventListener('mousemove', function(e) {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hx = (x / rect.width - 0.5) * 2;
      const hy = (y / rect.height - 0.5) * 2;
      el.style.setProperty('--hx', String(hx));
      el.style.setProperty('--hy', String(hy));
    });
    el.addEventListener('mouseleave', function() {
      el.style.setProperty('--hx', '0');
      el.style.setProperty('--hy', '0');
    });
  });

  let rest, full, vw, vh, pinRange = 0;
  let restEdges = { top:0, bottom:0, left:0, right:0 };
  let fullEdges = { top:0, bottom:0, left:0, right:0 };
  const currentEdges = { top:0, bottom:0, left:0, right:0 };

  let introDone = false, looping = false;
  let targetP = 0, currentP = 0, currentPanelP = 0;
  let panelVelocity = 0, scrollVelocity = 0;
  let lastTickTime = 0;
  let wasPlayingBeforeHidden = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const panelMotion = Object.fromEntries(['top', 'bottom', 'left', 'right'].map(edge => [edge, { displacement: 0, velocity: 0 }]));
  const panelGroups = {
    top: [document.getElementById('panel-top')],
    bottom: [document.getElementById('panel-bottom')],
    left: [document.getElementById('panel-left')],
    right: [document.getElementById('panel-right-base'), document.getElementById('panel-right-fake')]
  };
  let panelDrag = null;
  let suppressPanelClick = false;
  let clearingBrandSelection = false;
  window.addEventListener('pointerdown', () => {
    const selection = window.getSelection();
    clearingBrandSelection = !!selection && !selection.isCollapsed && !!selection.anchorNode?.parentElement?.closest('.allow-select');
  }, { capture: true, passive: true });

  let lenis = null;

  function initLenis(){
    if (lenis || !window.Lenis) return;

    lenis = new window.Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.15,
      gestureOrientation: 'vertical',
      smoothWheel: true,
      syncTouch: false,
      anchors: true
    });

    window.DHCSite = window.DHCSite || {};
    window.DHCSite.scroller = lenis;
    window.DHCLenis = lenis;
    const intro = document.getElementById('intro-card');
    if (intro && document.documentElement.dataset.entry !== 'quiet') lenis.stop();

    function raf(time){
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    lenis.on('scroll', function(e){ onScroll(e.scroll); });
    onScroll(lenis.scroll);
  }

  initLenis();
  document.getElementById('lenis-script')?.addEventListener('load', initLenis, { once: true });

  const REEL_TENSION = 280;
  const REEL_FRICTION = 26;

  const PANEL_TENSION = 120;
  const PANEL_FRICTION = 16;
  const PANEL_SPLIT_CLEARANCE = 48;
  const PANEL_GRIP_DELAY = 150;
  const PANEL_GRIP_SLOP = 8;
  const PANEL_RETURN_TENSION = 210;
  const PANEL_RETURN_DAMPING = 12;
  const PANEL_RETURN_FREQUENCY = Math.sqrt(PANEL_RETURN_TENSION - PANEL_RETURN_DAMPING ** 2);

  const lerp  = function(a, b, t){ return a + (b - a) * t; };
  const clamp = function(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); };

  function settlePanels(dt) {
    let settled = true;
    const decay = Math.exp(-PANEL_RETURN_DAMPING * dt);
    const cos = Math.cos(PANEL_RETURN_FREQUENCY * dt);
    const sin = Math.sin(PANEL_RETURN_FREQUENCY * dt) / PANEL_RETURN_FREQUENCY;
    for (const [edge, motion] of Object.entries(panelMotion)) {
      if (panelDrag?.edge === edge && panelDrag.armed) continue;
      if (reducedMotion.matches || (Math.abs(motion.displacement) < .05 && Math.abs(motion.velocity) < .1)) {
        motion.displacement = 0;
        motion.velocity = 0;
        continue;
      }
      const displacement = motion.displacement;
      const velocity = motion.velocity;
      motion.displacement = decay * (displacement * cos + (velocity + PANEL_RETURN_DAMPING * displacement) * sin);
      motion.velocity = decay * (velocity * cos - (PANEL_RETURN_DAMPING * velocity + PANEL_RETURN_TENSION * displacement) * sin);
      settled = false;
    }
    return settled;
  }

  function endPanelDrag(cancelled = false) {
    if (!panelDrag) return;
    const drag = panelDrag;
    panelDrag = null;
    clearTimeout(drag.timer);
    panelGroups[drag.edge].forEach(panel => panel.classList.remove('is-dragging'));
    if (drag.panel.hasPointerCapture(drag.pointerId)) drag.panel.releasePointerCapture(drag.pointerId);
    if (drag.armed) {
      panelMotion[drag.edge].velocity *= cancelled ? 0 : Math.exp(-Math.max(0, performance.now() - drag.time - 32) / 60);
    }
    suppressPanelClick = drag.moved && !cancelled;
    ensureLoop();
  }

  const panelControls = 'a, button, input, textarea, select, [role="button"], [contenteditable="true"], .allow-select, .scroll-hint';
  for (const [edge, panels] of Object.entries(panelGroups)) {
    panels.forEach(panel => {
      panel.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0 || panelDrag || !introDone || transitionActive || document.body.classList.contains('mobile-mode')) return;
        if (event.target.closest(panelControls) || document.querySelector('#intro-card:not(.exit)')) return;
        panelDrag = {
          edge, panel, pointerId: event.pointerId,
          x: event.clientX, y: event.clientY,
          lastX: event.clientX, lastY: event.clientY,
          displacement: panelMotion[edge].displacement,
          time: performance.now(), moved: false, armed: false, timer: 0
        };
        const drag = panelDrag;
        drag.timer = window.setTimeout(() => {
          if (panelDrag !== drag) return;
          drag.armed = true;
          drag.x = drag.lastX;
          drag.y = drag.lastY;
          drag.displacement = panelMotion[edge].displacement;
          drag.time = performance.now();
          panelMotion[edge].velocity = 0;
        }, PANEL_GRIP_DELAY);
        panel.setPointerCapture(event.pointerId);
      });
    });
  }
  document.addEventListener('pointermove', event => {
    const drag = panelDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.armed) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > PANEL_GRIP_SLOP) endPanelDrag(true);
      return;
    }
    const horizontal = drag.edge === 'left' || drag.edge === 'right';
    const delta = horizontal ? event.clientX - drag.x : event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(delta) < 3) return;
      drag.moved = true;
      panelGroups[drag.edge].forEach(panel => panel.classList.add('is-dragging'));
    }
    const direction = drag.edge === 'bottom' || drag.edge === 'right' ? -1 : 1;
    const next = drag.displacement + direction * delta;
    const now = performance.now();
    const elapsed = Math.max(.001, (now - drag.time) / 1000);
    const motion = panelMotion[drag.edge];
    const speed = clamp((next - motion.displacement) / elapsed, -1400, 1400);
    motion.velocity = lerp(motion.velocity, speed, 1 - Math.exp(-elapsed / .04));
    motion.displacement = next;
    drag.time = now;
    ensureLoop();
  }, { passive: true });
  document.addEventListener('pointerup', event => {
    if (panelDrag?.pointerId === event.pointerId) endPanelDrag();
  });
  ['pointercancel', 'lostpointercapture'].forEach(type => {
    document.addEventListener(type, event => {
      if (panelDrag?.pointerId === event.pointerId) endPanelDrag(true);
    });
  });
  document.addEventListener('pointerdown', () => { suppressPanelClick = false; }, { capture: true, passive: true });
  document.addEventListener('click', event => {
    if (!suppressPanelClick || event.detail === 0) return;
    suppressPanelClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') endPanelDrag(true);
  });
  window.addEventListener('blur', () => endPanelDrag(true));

  const ease = function(t){
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  function computeRects(){
    vw = window.innerWidth; 
    vh = window.innerHeight;

    const isMobile = vw < 760 || vh < 480 || document.documentElement.classList.contains('lite');

    if (isMobile) {
      document.body.classList.add('mobile-mode');
      const hr = document.getElementById('mobileHeroCopy') ? document.getElementById('mobileHeroCopy').getBoundingClientRect() : { bottom: vh * 0.3 };
      const gap = 24, marginX = 20, bottomMargin = 28;
      const restTop = Math.min(hr.bottom + gap, vh * 0.55);
      const restW = vw - marginX * 2;
      const restH = Math.max(220, vh - restTop - bottomMargin);
      rest = { left: marginX, top: restTop, width: restW, height: restH, radius: 22 };
      fullEdges = { top: 0, bottom: 0, left: 0, right: 0 };
    } else {
      document.body.classList.remove('mobile-mode');
      if (reel) {
        reel.style.clipPath = 'none';
        reel.classList.remove('is-full');
      }

      const restW2 = clamp(0.34 * vw, 320, 620);
      const restH2 = 0.6 * vh;
      const rightMargin = 0.08 * vw;
      let restLeftX = vw - restW2 - rightMargin;

      const brandEl = document.querySelector('#panel-top .brand');
      if (brandEl) {
        restLeftX = Math.max(restLeftX, brandEl.getBoundingClientRect().right + 8);
      }

      rest = { left: restLeftX, top: (vh - restH2) / 2, width: restW2, height: restH2, radius: 0 };

      fullEdges = {
        top: 100,
        bottom: 20, 
        left: 20,   
        right: 48   
      };

      docStyle.setProperty('--rest-left', rest.left + 'px');
      docStyle.setProperty('--rest-bottom', (vh - rest.top - rest.height) + 'px');
      docStyle.setProperty('--rest-top', rest.top + 'px');
    }

    full = { radius: 0 };

    restEdges = {
      top: rest.top,
      bottom: vh - rest.top - rest.height,
      left: rest.left,
      right: vw - rest.left - rest.width
    };

    if (!isMobile) {
      restEdges.right += 18;
    }

    pinRange = spacerEl ? (spacerEl.offsetHeight - vh) : 0;

    if(!isMobile) {
      initStaticBackgroundDesktop();
    }
  }

  function shrink(r, f){
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const w = r.width * f, h = r.height * f;
    return { left: cx - w/2, top: cy - h/2, width: w, height: h, radius: r.radius };
  }

  function initStaticBackgroundDesktop() {
    const deskLabel = document.getElementById('deskReelLabel');
    const deskControls = document.getElementById('deskReelControls');

    if (!deskLabel || !deskControls) return;

    const sidePadding = '6vw';
    const bottomLevel = '40px';

    deskLabel.style.left = sidePadding;
    deskLabel.style.bottom = bottomLevel;
    deskLabel.style.opacity = '1';

    deskControls.style.right = sidePadding;
    deskControls.style.bottom = bottomLevel;
    deskControls.style.opacity = '1';

    const leftAnchor = '12vw';
    const midY = vh * 0.45;
    const gap = clamp(vh * 0.12, 60, 100);

    if (dTexts[0]) { dTexts[0].style.left = leftAnchor; dTexts[0].style.top = (midY - gap) + 'px'; }
    if (dTexts[1]) { dTexts[1].style.left = leftAnchor; dTexts[1].style.top = midY + 'px'; }
    if (dTexts[2]) { dTexts[2].style.left = leftAnchor; dTexts[2].style.right = 'auto'; dTexts[2].style.top = (midY + gap) + 'px'; }
  }

  function panelOffset(edge, base, inwardRange) {
    const displacement = panelMotion[edge].displacement;
    const available = displacement < 0 ? Math.max(0, base - 12) : Math.max(0, inwardRange);
    const range = edge === 'right' ? Math.min(6, available) : available;
    return range > 0 ? range * displacement / (range + Math.abs(displacement)) : 0;
  }

  function applyDesktopEdges(e) {
    const topBase = Math.max(12, e.top);
    const bottomBase = Math.max(36, e.bottom);
    const leftBase = Math.max(36, e.left);
    const rightBase = Math.max(84, e.right);
    const bottomRange = Math.min(vh * .35, (vh - topBase - 3 * PANEL_SPLIT_CLEARANCE) / 2 - bottomBase);
    const top = topBase + panelOffset('top', topBase, vh * .35);
    const bottom = bottomBase + panelOffset('bottom', bottomBase, bottomRange);
    const left = leftBase + panelOffset('left', leftBase, vw * .35);
    const right = rightBase + panelOffset('right', rightBase, vw * .35);
    docStyle.setProperty('--p-top', top + 'px');
    docStyle.setProperty('--p-bottom', bottom + 'px');
    docStyle.setProperty('--p-left', left + 'px');
    docStyle.setProperty('--p-right', right + 'px');
    
    const split = Math.min((2 * vh + top - bottom) / 3, vh - bottom - PANEL_SPLIT_CLEARANCE);
    docStyle.setProperty('--split-y', split + 'px');
  }

  const S_TEXT_WINDOWS = [[0.50,0.68], [0.60,0.80], [0.72,0.92]];

  function paintMobile(r, p) {
    if (!reel) return;
    const right = vw - (r.left + r.width), bottom = vh - (r.top + r.height);
    reel.style.clipPath = 'inset(' + r.top + 'px ' + right + 'px ' + bottom + 'px ' + r.left + 'px round ' + (r.radius || 0) + 'px)';

    const mControls = document.getElementById('mobileReelControls');
    if (mControls) {
      mControls.style.left = (r.left + 20) + 'px';
      mControls.style.top  = (r.top + r.height - 44) + 'px';
    }

    const midY = r.top + r.height * 0.45;
    const gap = clamp(vh * 0.12, 60, 100);
    const topY = Math.max(midY - gap, 104);
    const botY = midY + gap;

    if (mTexts[0]) { mTexts[0].style.left = (r.left + 28) + 'px'; mTexts[0].style.top = topY + 'px'; }
    if (mTexts[1]) { mTexts[1].style.left = (r.left + 28) + 'px'; mTexts[1].style.top = midY + 'px'; }
    if (mTexts[2]) { mTexts[2].style.left = (r.left + 28) + 'px'; mTexts[2].style.right = 'auto'; mTexts[2].style.top = botY + 'px'; }

    for (let i = 0; i < mTexts.length; i++){
      const w = S_TEXT_WINDOWS[i];
      const t = clamp((p - w[0]) / (w[1] - w[0]), 0, 1);
      mTexts[i].style.opacity = String(t);
      mTexts[i].style.transform = 'translateY(' + (16*(1-t)) + 'px)';
      mTexts[i].style.pointerEvents = (t > 0.02) ? 'auto' : 'none';
    }
  }

  const rectScratch = { left: 0, top: 0, width: 0, height: 0, radius: 0 };
  const desktopEdges = { top:0, bottom:0, left:0, right:0 };

  function frame(p, panelP){
    currentEdges.top    = lerp(restEdges.top,    fullEdges.top,    p);
    currentEdges.bottom = lerp(restEdges.bottom, fullEdges.bottom, p);
    currentEdges.left   = lerp(restEdges.left,   fullEdges.left,   p);
    currentEdges.right  = lerp(restEdges.right,  fullEdges.right,  p);

    rectScratch.left   = currentEdges.left;
    rectScratch.top    = currentEdges.top;
    rectScratch.width  = vw - currentEdges.left - currentEdges.right;
    rectScratch.height = vh - currentEdges.top - currentEdges.bottom;

    const isMobile = document.body.classList.contains('mobile-mode');

    if (isMobile) {
      rectScratch.radius = lerp(rest.radius, full.radius, p);
      paintMobile(rectScratch, p);

      const mHero = document.getElementById('mobileHeroCopy');
      const mScroll = document.getElementById('mobileScrollHint');

      if (mHero) mHero.style.opacity = String(clamp(1 - p / 0.35, 0, 1));
      if (mScroll) mScroll.style.opacity = p > 0.02 ? '0' : '1';
      if (reel) reel.classList.toggle('is-full', p > 0.995);

    } else {
      desktopEdges.top    = lerp(restEdges.top,    fullEdges.top,    panelP);
      desktopEdges.bottom = lerp(restEdges.bottom, fullEdges.bottom, panelP);
      desktopEdges.left   = lerp(restEdges.left,   fullEdges.left,   panelP);
      desktopEdges.right  = lerp(restEdges.right,  fullEdges.right,  panelP);
      applyDesktopEdges(desktopEdges);
      if (reel) reel.classList.toggle('is-full', p > 0.995);
    }
  }

  function tick(now){
    if (transitionActive) { looping = false; lastTickTime = 0; return; }
    if (!lastTickTime) lastTickTime = now;
    const dt = Math.min((now - lastTickTime) / 1000, 0.05);
    lastTickTime = now;

    const reelDisplacement = targetP - currentP;
    const reelAccel = (REEL_TENSION * reelDisplacement) - (REEL_FRICTION * scrollVelocity);

    const panelDisplacement = targetP - currentPanelP;
    const panelAccel = (PANEL_TENSION * panelDisplacement) - (PANEL_FRICTION * panelVelocity);

    scrollVelocity += reelAccel * dt;
    currentP += scrollVelocity * dt;

    panelVelocity += panelAccel * dt;
    currentPanelP += panelVelocity * dt;

    const reelSettled = Math.abs(reelDisplacement) < 0.0002 && Math.abs(scrollVelocity) < 0.001;
    const panelSettled = Math.abs(panelDisplacement) < 0.0002 && Math.abs(panelVelocity) < 0.001;

    if (reelSettled) { currentP = targetP; scrollVelocity = 0; }
    if (panelSettled) { currentPanelP = targetP; panelVelocity = 0; }

    const dragSettled = settlePanels(dt);

    frame(currentP, currentPanelP);

    if (!(reelSettled && panelSettled && dragSettled)) {
      requestAnimationFrame(tick);
    } else {
      looping = false;
      lastTickTime = 0;
    }
  }

  function ensureLoop(){ 
    if (!looping){ 
      looping = true; 
      lastTickTime = performance.now();
      requestAnimationFrame(tick); 
    } 
  }

  function onScroll(scrollY){
    if (!introDone || transitionActive) return;
    if (typeof scrollY !== 'number') scrollY = window.scrollY;
    targetP = pinRange > 0 ? clamp(scrollY / pinRange, 0, 1) : 0;
    ensureLoop();
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  let resizeFrame;
  window.addEventListener('resize', function(){
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(function(){
      endPanelDrag(true);
      Object.values(panelMotion).forEach(motion => { motion.displacement = 0; motion.velocity = 0; });
      computeRects();
      if (introDone) onScroll();
    });
  });

  function animateScrollTo(targetY, duration){
    const startY = window.scrollY, t0 = performance.now();
    (function step(now){
      const t = clamp((now - t0) / duration, 0, 1);
      window.scrollTo(0, lerp(startY, targetY, ease(t)));
      if (t < 1) requestAnimationFrame(step);
    })(t0);
  }

  function scrollToTarget(targetY, duration){
    if (lenis) {
      lenis.scrollTo(targetY, { duration: duration / 1000, easing: ease });
    } else {
      animateScrollTo(targetY, duration);
    }
  }

  function nudgeScroll(){
    if (pinRange <= 0) return;
    scrollToTarget(clamp(window.scrollY + vh * 0.85, 0, pinRange), 650);
  }

  [document.getElementById('scrollHint'), document.getElementById('mobileScrollHint')].forEach(function(el){
    if (el) el.addEventListener('click', nudgeScroll);
  });

  if (reel) {
    reel.addEventListener('click', function(){
      if (clearingBrandSelection || !introDone || pinRange <= 0 || targetP >= 0.995) return;
      scrollToTarget(pinRange, 650);
    });
  }

  function playIntro(){
    computeRects();
    const start = shrink(rest, 0.86);

    const startEdges = {
      top: start.top,
      bottom: vh - start.top - start.height,
      left: start.left,
      right: vw - start.left - start.width
    };

    const isMobile = document.body.classList.contains('mobile-mode');

    if (isMobile) {
      paintMobile(start, 0);
      if (reel) {
        reel.style.opacity = '0';
        reel.style.transition = 'none';
        void reel.offsetWidth;
      }
      const mControls = document.getElementById('mobileReelControls');
      if (mControls) mControls.style.opacity = '0';

      requestAnimationFrame(function(){
        if (reel) {
          reel.style.transition = 'clip-path .9s cubic-bezier(.16,1,.3,1), opacity .6s ease';
          reel.style.opacity = '1';
        }
        paintMobile(rest, 0);
        if (mControls) mControls.style.opacity = '1';
        const mHero = document.getElementById('mobileHeroCopy');
        if (mHero) mHero.classList.add('in');
      });

      setTimeout(function(){
        if (reel) reel.style.transition = 'none';
        introDone = true;
        onScroll();
      }, 950);

    } else {
      applyDesktopEdges(startEdges);
      void panelGroups.top[0].offsetHeight;
      requestAnimationFrame(function(){
        document.documentElement.classList.add('panel-anim');
        applyDesktopEdges(restEdges);
      });
      setTimeout(function(){
        document.documentElement.classList.remove('panel-anim');
        introDone = true;
        onScroll();
      }, 950);
    }
  }

  const lite    = document.documentElement.classList.contains('lite');
  const lowData = !!window.__DHC_LOWDATA__;
  const VIDEO_SRC = lite ? './assets/finalcompressedver2_lite.mp4' : './assets/finalcompressedver2.mp4';
  const videoReady = new Promise(resolve => {
    if (!video || lowData) { resolve(); return; }
    let ready = false;
    function finish() {
      if (ready) return;
      ready = true;
      if (video.readyState >= 2) reel.dataset.videoReady = 'true';
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('error', finish);
      resolve();
    }
    if (video.readyState >= 2) finish();
    else {
      video.addEventListener('loadeddata', finish);
      video.addEventListener('error', finish);
    }
  });
  video?.addEventListener('loadeddata', () => { reel.dataset.videoReady = 'true'; });

  if (video) {
   if (lowData) {
    video.removeAttribute('autoplay');
    video.preload = 'none';
   } else {
    video.src = VIDEO_SRC;
    video.preload = 'auto';
   }
  }

  function ensureVideoSource(){
    if (video && !video.currentSrc) video.src = VIDEO_SRC;
  }

  const playBtns = document.querySelectorAll('.play-btn');
  const muteBtns = document.querySelectorAll('.mute-btn');

  function updateControls(){
    if (!video) return;
    const paused = video.paused, muted = video.muted;
    playBtns.forEach(b => {
      b.dataset.playing = paused ? 'false' : 'true';
      b.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
      b.title = paused ? 'Play video' : 'Pause video';
    });
    muteBtns.forEach(b => {
      b.dataset.muted = muted ? 'true' : 'false';
      b.setAttribute('aria-label', muted ? 'Unmute video' : 'Mute video');
      b.title = muted ? 'Unmute video' : 'Mute video';
    });
  }

  playBtns.forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    ensureVideoSource();
    if (!video) return;
    video.paused ? video.play().catch(()=>{}) : video.pause();
    updateControls();
  }));

  muteBtns.forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    ensureVideoSource();
    if (!video) return;
    
    if (video.muted) {
      video.volume = 0;
      video.muted = false;
      fadeVolume(video, 1, 500);
      updateControls();
    } else {
      muteBtns.forEach(btn => {
        btn.dataset.muted = 'true';
        btn.setAttribute('aria-label', 'Unmute video');
        btn.title = 'Unmute video';
      });
      fadeVolume(video, 0, 500);
      setTimeout(() => {
        if (!video.paused) {
          video.muted = true;
          video.volume = 1;
        }
        updateControls();
      }, 500);
    }
  }));

  if (video) {
    video.addEventListener('play', updateControls); 
    video.addEventListener('pause', updateControls); 
    video.addEventListener('volumechange', updateControls);
  }
  updateControls();

  const S_TEXT_COLORS = [
    { t: 0.000,  main: '#00FFFF', g1: '#FF00FF', g2: '#FFFF00' },
    { t: 6.000,  main: '#FF00FF', g1: '#00FF00', g2: '#00FFFF' },
    { t: 6.250,  main: '#FFFF00', g1: '#9900FF', g2: '#00FFCC' },
    { t: 13.833, main: '#00FFFF', g1: '#FF0000', g2: '#FFFF00' },
    { t: 13.950, main: '#00FF00', g1: '#FF6600', g2: '#FF0099' },
    { t: 16.583, main: '#FF00FF', g1: '#FFFF00', g2: '#0066FF' },
    { t: 17.000, main: '#00FFFF', g1: '#FF00FF', g2: '#00FF00' },
    { t: 22.750, main: '#FFFFFF', g1: '#444444', g2: '#888888' },
    { t: 25.042, main: '#C8FFFF', g1: '#FF2222', g2: '#2222FF' },
    { t: 28.667, main: '#FF00FF', g1: '#FFCC00', g2: '#00FFFF' }
  ].sort(function(a, b){ return a.t - b.t; });

  let sTextKeyframe = null;

  function colorForTime(t){
    let kf = S_TEXT_COLORS[0];
    for (let i = 0; i < S_TEXT_COLORS.length; i++){
      if (S_TEXT_COLORS[i].t <= t) kf = S_TEXT_COLORS[i]; else break;
    }
    return kf;
  }

  function paintSText(t){
    const kf = colorForTime(t);
    if (kf === sTextKeyframe) return;
    sTextKeyframe = kf;
    docStyle.setProperty('--s-main', kf.main);
    docStyle.setProperty('--s-g1', kf.g1);
    docStyle.setProperty('--s-g2', kf.g2);
  }

  if (video) {
    if (typeof video.requestVideoFrameCallback === 'function') {
      const onVideoFrame = function(now, metadata){
        paintSText(metadata.mediaTime);
        video.requestVideoFrameCallback(onVideoFrame);
      };
      video.requestVideoFrameCallback(onVideoFrame);
    } else {
      video.addEventListener('timeupdate', function(){ paintSText(video.currentTime); });
    }
    video.addEventListener('play', function(){ paintSText(video.currentTime); });
  }
  paintSText(0);

  (function generatePaperTexture() {
    if (document.documentElement.classList.contains('lite') || window.innerWidth < 760 || window.innerHeight < 480) return;

    const canvas = document.createElement('canvas');
    const size = 300; 
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let i = 0; i < 400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 10 + Math.random() * 30;
      
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(160, 150, 135, 0.15)'); 
      grad.addColorStop(1, 'rgba(160, 150, 135, 0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 300; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 5 + Math.random() * 20;
      
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 1 + Math.random() * 2; 
      const angle = Math.random() * Math.PI * 2;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      
      const isLight = Math.random() > 0.45;
      ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(130, 120, 110, 0.35)';
      ctx.lineWidth = 0.5 + Math.random() * 0.5;
      ctx.stroke();
    }

    for (let i = 0; i < 1200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 3 + Math.random() * 6; 
      const angle = Math.random() * Math.PI * 2;
      
      const cpX = x + Math.cos(angle + 0.5) * (len * 0.5);
      const cpY = y + Math.sin(angle + 0.5) * (len * 0.5);
      const endX = x + Math.cos(angle) * len;
      const endY = y + Math.sin(angle) * len;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      
      const isLit = Math.random() > 0.5;
      ctx.strokeStyle = isLit ? 'rgba(255, 255, 255, 0.8)' : 'rgba(120, 110, 100, 0.4)';
      ctx.lineWidth = 0.8 + Math.random() * 0.4;
      
      ctx.shadowColor = 'rgba(100, 90, 80, 0.15)';
      ctx.shadowBlur = 1;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 0.5;
      ctx.stroke();
      
      ctx.shadowColor = 'transparent'; 
    }
    
    const dataURL = canvas.toDataURL('image/png');
    document.querySelectorAll('.panel-fray').forEach(el => {
      el.style.backgroundImage = `url(${dataURL})`;
      el.style.backgroundSize = `${size}px ${size}px`; 
    });
  })();

  let revealed = false;
  let siteStarted = false;
  const sceneReady = (window.DHCSite?.fontsReady || document.fonts?.ready || Promise.resolve()).then(() => {
    computeRects();
    if (!siteStarted) frame(0, 0);
    else frame(currentP, currentPanelP);
    document.documentElement.dataset.sceneReady = 'true';
  });

  function fadeVolume(vid, targetVolume, duration) {
    const startVolume = vid.volume;
    const startTime = performance.now();
    function step(now) {
      const p = Math.min((now - startTime) / duration, 1);
      vid.volume = startVolume + (targetVolume - startVolume) * p;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function tryAutoPlay(){
    if (!video) return;

    video.muted = true;
    video.volume = 0;

    if (!video.currentSrc) video.src = VIDEO_SRC;

    const playPromise = video.play();

    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(function(){
          video.muted = true;
          video.volume = 1;
          updateControls();
        })
        .catch(function(){
          updateControls();
        });
    } else {
      updateControls();
    }
  }

  async function startSite(){
    if (siteStarted) return;
    siteStarted = true;
    await sceneReady;
    if (!lowData) tryAutoPlay();
    let wait;
    await Promise.race([videoReady, new Promise(resolve => { wait = setTimeout(resolve, 1200); })]);
    clearTimeout(wait);
    if (window.scrollY > 1) {
      introDone = true;
      targetP = pinRange > 0 ? clamp(window.scrollY / pinRange, 0, 1) : 0;
      currentP = currentPanelP = targetP;
      frame(currentP, currentPanelP);
    } else {
      playIntro();
    }
  }

  function reveal(){
    if (revealed) return;
    revealed = true;
    const params = new URLSearchParams(location.search);
    if (document.documentElement.dataset.entry === 'quiet') {
      document.getElementById('intro-card')?.remove();
      if (params.get('v') === 'd') params.delete('v');
      const query = params.toString();
      history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
      siteStarted = true;
      introDone = true;
      computeRects();
      if (!lowData) tryAutoPlay();
      targetP = pinRange > 0 ? clamp(window.scrollY / pinRange, 0, 1) : 0;
      currentP = currentPanelP = targetP;
      frame(currentP, currentPanelP);
      if (lenis) lenis.start();
      window.DHCMark?.ready.then(loaded => {
        if (loaded) window.DHCMark.updateFavicon(matchMedia('(prefers-color-scheme: dark)').matches);
      });
      return;
    }

    const vwNow = window.innerWidth;
    const vhNow = window.innerHeight;
    const isMobileNow = vwNow < 760 || vhNow < 480 || lite;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wantsGlass = !lite && !lowData && !isMobileNow && !reducedMotion &&
      window.DHCGlassLoader && typeof window.DHCGlassLoader.play === 'function';

    let animationResolved = false;
    let resolveAnimation;
    const animationDone = new Promise(function(resolve){
      resolveAnimation = function(){
        if (animationResolved) return;
        animationResolved = true;
        resolve();
      };
    });

    if (window.showIntroOverlay) {
      window.showIntroOverlay(false, animationDone, startSite);
    } else {
      startSite();
      resolveAnimation();
      return;
    }

    if (wantsGlass) {
      try {
        window.DHCGlassLoader.play(function(){
          resolveAnimation();
        });
      } catch (_) {
        resolveAnimation();
      }
    } else {
      resolveAnimation();

      if (window.DHCMark && window.DHCMark.ready && typeof window.DHCMark.ready.then === 'function') {
        window.DHCMark.ready.then(function(loaded){
          if (!loaded) return;
          const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (typeof window.DHCMark.bounceFavicon === 'function') {
            window.DHCMark.bounceFavicon(dark);
          } else if (typeof window.DHCMark.updateFavicon === 'function') {
            window.DHCMark.updateFavicon(dark);
          }
        });
      }
    }
  }

  reveal();

  var transitionActive = false;
  var transitionDest = '';
  var transitionHistoryAdded = false;
  var transitionImage = new URL('./assets/github.jpg', window.location.href).href;
  var pushStartTime = 0;
  var pushRafId = null;
  var PUSH_DURATION = 1050;
  var takeStartTime = 0;
  var takeRafId = null;
  var TAKE_DURATION = 820;
  var takeoverStarted = false;
  var PUSH_OVERLAP = 0.45;
  var pushStartEdges = { top: 0, bottom: 0, left: 0 };
  var rightStartWidth = 0;
  var PUSH_OVERSHOOT = 80;

  function easeInCubic(t) {
    t = clamp(t, 0, 1);
    return t * t * t;
  }

  function getPushOffEdges() {
    return {
      top: -(vh + PUSH_OVERSHOOT),
      bottom: -(vh + PUSH_OVERSHOOT),
      left: -(vw + PUSH_OVERSHOOT)
    };
  }

  function applyPushFrame(p) {
    var offEdges = getPushOffEdges();
    var pTop = lerp(pushStartEdges.top, offEdges.top, p);
    docStyle.setProperty('--p-top', pTop + 'px');
    var pBottom = lerp(pushStartEdges.bottom, offEdges.bottom, p);
    docStyle.setProperty('--p-bottom', pBottom + 'px');
    var pLeft = lerp(pushStartEdges.left, offEdges.left, p);
    docStyle.setProperty('--p-left', pLeft + 'px');

    var centerSplit = pTop + (vh - pTop - pBottom) / 2;
    var adjustedSplit = centerSplit + (vh - centerSplit) / 3;
    docStyle.setProperty('--split-y', adjustedSplit + 'px');
  }

  function pushTick(now) {
    if (!pushStartTime) pushStartTime = now;
    var linearP = clamp((now - pushStartTime) / PUSH_DURATION, 0, 1);

    applyPushFrame(easeInCubic(linearP));

    if (linearP > PUSH_OVERLAP && !takeoverStarted) {
      onPushComplete();
    }

    if (linearP < 1) {
      pushRafId = requestAnimationFrame(pushTick);
    } else {
      pushRafId = null;
      if (!takeoverStarted) onPushComplete();
    }
  }

  function startPush() {
    pushStartTime = 0;
    takeoverStarted = false;
    if (pushRafId) cancelAnimationFrame(pushRafId);
    pushRafId = requestAnimationFrame(pushTick);
  }

  function onPushComplete() {
    if (takeoverStarted) return;
    takeoverStarted = true;

    var rightBase = document.getElementById('panel-right-base');
    var rightFake = document.getElementById('panel-right-fake');

    if (rightBase) {
      rightBase.classList.add('takeover-ready');
      rightBase.style.willChange = 'clip-path, width, transform';
    }
    if (rightFake) rightFake.style.display = 'none';

    var currentRight = parseFloat(docStyle.getPropertyValue('--p-right')) || restEdges.right;
    rightStartWidth = Math.max(currentRight, 84);

    startTakeover();
  }

  function applyTakeoverFrame(p) {
    var targetWidth = vw + PUSH_OVERSHOOT;
    var w = lerp(rightStartWidth, targetWidth, p);
    docStyle.setProperty('--p-right', w + 'px');
  }

  function takeTick(now) {
    if (!takeStartTime) takeStartTime = now;
    var linearP = clamp((now - takeStartTime) / TAKE_DURATION, 0, 1);

    applyTakeoverFrame(easeInCubic(linearP));

    if (linearP < 1) {
      takeRafId = requestAnimationFrame(takeTick);
    } else {
      takeRafId = null;
      onTakeoverComplete();
    }
  }

  function startTakeover() {
    takeStartTime = 0;
    if (takeRafId) cancelAnimationFrame(takeRafId);
    takeRafId = requestAnimationFrame(takeTick);
  }

  function onTakeoverComplete() {
    document.body.style.backgroundImage = 'url("' + transitionImage + '")';
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.documentElement.style.backgroundImage = 'url("' + transitionImage + '")';
    document.documentElement.style.backgroundSize = "cover";
    document.documentElement.style.backgroundPosition = "center";
    document.documentElement.style.backgroundRepeat = "no-repeat";
    requestAnimationFrame(function() {
      if (transitionHistoryAdded) window.location.replace(transitionDest);
      else window.location.href = transitionDest;
    });
  }

  document.addEventListener('click', function(e) {
    var link = e.target.closest('[data-transition-dest]');
    if (!link) return;

    var dest = link.href || link.getAttribute('href');
    if (!dest || dest === '#') return;

    e.preventDefault();

    var isMobile = document.body.classList.contains('mobile-mode') || document.documentElement.classList.contains('lite');
    if (isMobile) {
      window.location.href = dest;
      return;
    }

    if (transitionActive) return;
    endPanelDrag(true);
    transitionActive = true;
    transitionDest = dest;

    var imgPreload = new Image();
    imgPreload.src = transitionImage;

    try {
      var returnURL = new URL(window.location.href);
      var siteBase = new URL('.', returnURL);
      var newPath = new URL(new URL(dest).pathname.replace(/^\/+/, ''), siteBase).pathname;
      history.pushState({ transition: newPath, destination: dest }, '', newPath);
      transitionHistoryAdded = true;
    } catch (e) {
      console.warn('URL update failed:', e);
    }

    document.documentElement.classList.add('transition-active');
    if (lenis) lenis.stop();
    document.body.style.overflow = 'hidden';

    var computedTop = parseFloat(docStyle.getPropertyValue('--p-top')) || currentEdges.top;
    var computedBottom = parseFloat(docStyle.getPropertyValue('--p-bottom')) || currentEdges.bottom;
    var computedLeft = parseFloat(docStyle.getPropertyValue('--p-left')) || currentEdges.left;

    pushStartEdges.top = computedTop;
    pushStartEdges.bottom = computedBottom;
    pushStartEdges.left = computedLeft;

    startPush();
  });

  document.addEventListener('visibilitychange', () => {
    if (!video) return;
    if (document.hidden) {
      wasPlayingBeforeHidden = !video.paused;
      video.pause();
    } else {
      if (wasPlayingBeforeHidden) {
        if (!video.muted) {
          video.volume = 0;
          video.play().then(() => {
            fadeVolume(video, 1, 1000);
          }).catch(()=>{});
        } else {
          video.play().catch(()=>{});
        }
      }
    }
  });
  
  function restoreLandingPage() {
    if (history.state?.transition === window.location.pathname && history.state.destination) {
      window.location.replace(history.state.destination);
      return;
    }
    if (!transitionActive) return;
    transitionActive = false;
    cancelAnimationFrame(pushRafId);
    cancelAnimationFrame(takeRafId);
    document.documentElement.classList.remove('transition-active');
    var rightBase = document.getElementById('panel-right-base');
    rightBase.classList.remove('takeover-ready');
    rightBase.style.removeProperty('will-change');
    document.getElementById('panel-right-fake').style.removeProperty('display');
    [document.body, document.documentElement].forEach(function(element) {
      ['background-image', 'background-size', 'background-position', 'background-repeat'].forEach(function(property) {
        element.style.removeProperty(property);
      });
    });
    document.body.style.removeProperty('overflow');
    computeRects();
    frame(currentP, currentPanelP);
    if (lenis) lenis.start();
    ensureLoop();
  }

  window.addEventListener('pageshow', function(event) {
    if (event.persisted) restoreLandingPage();
  });
  window.addEventListener('popstate', restoreLandingPage);

  document.addEventListener('keydown', event => {
    if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && event.key === 'I')) event.preventDefault();
  });

})();
