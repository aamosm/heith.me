(function(){
  const docStyle = document.documentElement.style;
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

  const LENIS_VERSION = '1.3.26';
  let lenis = null;

  (function loadLenis(){
    if (!document.getElementById('lenis-css')) {
      const link = document.createElement('link');
      link.id = 'lenis-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/lenis@' + LENIS_VERSION + '/dist/lenis.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lenis@' + LENIS_VERSION + '/dist/lenis.min.js';
    script.onload = initLenis;
    script.onerror = function(){
      console.warn('[scroll] Lenis failed to load — falling back to native scroll.');
    };
    document.head.appendChild(script);
  })();

  function initLenis(){
    lenis = new window.Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.15,
      gestureOrientation: 'vertical',
      smoothWheel: true,
      syncTouch: false,
      anchors: true
    });

    function raf(time){
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    lenis.on('scroll', function(e){ onScroll(e.scroll); });
    onScroll(lenis.scroll);
  }

  const REEL_TENSION = 280;
  const REEL_FRICTION = 26;

  const PANEL_TENSION = 120;
  const PANEL_FRICTION = 16;

  const lerp  = function(a, b, t){ return a + (b - a) * t; };
  const clamp = function(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); };

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

    if(!introDone && !isMobile) {
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

  function applyDesktopEdges(e) {
    docStyle.setProperty('--p-top', e.top + 'px');
    docStyle.setProperty('--p-bottom', e.bottom + 'px');
    docStyle.setProperty('--p-left', e.left + 'px');
    docStyle.setProperty('--p-right', e.right + 'px');
    
    const centerSplit = e.top + (vh - e.top - e.bottom) / 2;
    const adjustedSplit = centerSplit + (vh - centerSplit) / 3;
    docStyle.setProperty('--split-y', adjustedSplit + 'px');
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

    frame(currentP, currentPanelP);

    if (!(reelSettled && panelSettled)) {
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
      computeRects();
      if (introDone) onScroll();
    });
  });

  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(function(){ computeRects(); onScroll(); });
  }

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
      if (!introDone || pinRange <= 0 || targetP >= 0.995) return;
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

  const loader  = document.getElementById('loader');
  const lite    = document.documentElement.classList.contains('lite');
  const lowData = !!window.__DHC_LOWDATA__;
  const VIDEO_SRC = lite ? './assets/finalcompressedver2_lite.mp4' : './assets/finalcompressedver2.mp4';

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

  const FALLBACK_MS = lowData ? 600 : 4000;
  const NEEDED = 2;
  let readyCount = 0, revealed = false;

  function markReady(){ readyCount += 1; if (readyCount >= NEEDED) reveal(); }

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

  if (!video.currentSrc) {
    video.src = VIDEO_SRC;
  }

  const playPromise = video.play();

  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(function(){
        video.muted = true;
        video.volume = 1;
        updateControls();
      })
      .catch(function(err){
        console.warn('[video] autoplay failed:', err);
        updateControls();
      });
  } else {
    updateControls();
  }
}

function finishReveal(){
  if (!lowData) tryAutoPlay();
  playIntro();
}

  function reveal(){
    if (revealed) return; 
    revealed = true;
    document.documentElement.style.overflow = '';

    const vwNow = window.innerWidth, vhNow = window.innerHeight;
    const isMobileNow = vwNow < 760 || vhNow < 480 || lite;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const wantsGlass = !lite && !lowData && !isMobileNow && !reducedMotion &&
      window.DHCGlassLoader && typeof window.DHCGlassLoader.play === 'function';

    if (!wantsGlass) {
      console.info('[glass-loader] not attempted:', {
        lite: lite, lowData: lowData, isMobileNow: isMobileNow, reducedMotion: reducedMotion,
        moduleLoaded: !!(window.DHCGlassLoader && window.DHCGlassLoader.play)
      });
    }

    if (wantsGlass) {
      window.DHCGlassLoader.play(function(){
        if (loader) loader.remove();
        finishReveal();
      });
      return;
    }

    if (loader) {
      loader.classList.add('done');
      setTimeout(()=>loader.remove(), 500);
    }

    if (window.DHCMark && window.DHCMark.ready) {
      window.DHCMark.ready.then(function(loaded){
        if (!loaded) return;
        var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (typeof window.DHCMark.bounceFavicon === 'function') {
          window.DHCMark.bounceFavicon(dark);
        } else if (typeof window.DHCMark.updateFavicon === 'function') {
          window.DHCMark.updateFavicon(dark);
        }
      });
    }

    finishReveal();
  }

  document.documentElement.style.overflow = 'hidden';
  setTimeout(reveal, FALLBACK_MS);

  if (lowData) {
    markReady();
  } else if (video && video.readyState >= 3) {
    markReady();
  } else if (video) {
    video.addEventListener('canplay', markReady, { once: true });
  } else {
    markReady();
  }

  if (!document.fonts || document.fonts.status === 'loaded') {
    markReady();
  } else {
    document.fonts.ready.then(markReady);
  }

  var transitionActive = false;
  var transitionDest = '';
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
    document.body.style.backgroundImage = "url('./assets/github.jpg')";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.documentElement.style.backgroundImage = "url('./assets/github.jpg')";
    document.documentElement.style.backgroundSize = "cover";
    document.documentElement.style.backgroundPosition = "center";
    document.documentElement.style.backgroundRepeat = "no-repeat";
    requestAnimationFrame(function() {
      window.location.href = transitionDest;
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
    transitionActive = true;
    transitionDest = dest;

    var imgPreload = new Image();
    imgPreload.src = './assets/github.jpg';

    try {
      var newPath = '/placeholder';

try {
  var u = new URL(dest);
  var newPath = u.pathname;

  if (u.hostname.toLowerCase() === 'github.com') {
    var siteBase = '/';

    if (window.location.hostname.toLowerCase().endsWith('.github.io')) {
      var currentParts = window.location.pathname.split('/').filter(Boolean);

      if (currentParts.length > 0) {
        siteBase = '/' + currentParts[0] + '/';
      }
    }

    newPath =
      siteBase +
      u.pathname.replace(/^\/+/, '');
  }

  history.pushState({ transition: newPath }, '', newPath);
} catch (_) {
  var newPath = dest.startsWith('/') ? dest : '/' + dest;
  history.pushState({ transition: newPath }, '', newPath);
}

      history.pushState({ transition: newPath }, '', newPath);
    } catch(e) {
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
  
  window.addEventListener('pageshow', function (event) {
    if (event.persisted || document.documentElement.classList.contains('transition-active')) {
      window.location.reload();
    }
  });

  window.addEventListener('popstate', function () {
    if (document.documentElement.classList.contains('transition-active')) {
      window.location.reload();
    }
  });

})();
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => { if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) { e.preventDefault(); } });