(function(){
  var FILL_IN_TIMEOUT_MS = 700;
  var READY_TIMEOUT_MS = 2500;
  var CANVAS_SIZE = 200;

  function buildOverlay(){
    var overlay = document.createElement('div');
    overlay.id = 'glass-loader';

    var shell = document.createElement('div');
    shell.className = 'glass-shell';

    var canvas = document.createElement('canvas');
    canvas.className = 'glass-mark';
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    shell.appendChild(canvas);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);

    return { overlay: overlay, shell: shell, canvas: canvas };
  }

  function play(onDone){
    var done = false;
    var imageWait;
    function finish(){
      if (done) return;
      done = true;
      clearTimeout(imageWait);
      onDone();
    }

    if (!window.DHCMark ||
        typeof window.DHCMark.render !== 'function' ||
        !window.DHCMark.ready ||
        typeof window.DHCMark.ready.then !== 'function') {
      finish();
      return;
    }

    imageWait = setTimeout(finish, READY_TIMEOUT_MS);
    window.DHCMark.ready.then(function(loaded){
      if (done) return;
      clearTimeout(imageWait);
      if (!loaded) {
        console.warn('[glass-loader] skipped: DHCMark reported the source image was not usable (see the [DHCMark] warning above).');
        finish();
        return;
      }

      var dom = buildOverlay();
      var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      window.DHCMark.suppressAutoUpdate = true;

      window.DHCMark.render(dom.canvas, { resolve: 1, dark: dark });

      void dom.shell.offsetWidth;
      requestAnimationFrame(function(){
        dom.overlay.classList.add('in');
        dom.overlay.classList.add('filled');
        runFillIn(dom, dark, finish);
      });
    }).catch(function(){ finish(); });
  }

  function runFillIn(dom, dark, finish){
    var settled = false;
    var fillTimer;
    function proceed(){
      if (settled) return;
      settled = true;
      clearTimeout(fillTimer);
      dom.shell.removeEventListener('transitionend', onEnd);
      runAscent(dom, dark, finish);
    }
    function onEnd(e){
      if (e.target === dom.shell && e.propertyName === 'transform') proceed();
    }
    dom.shell.addEventListener('transitionend', onEnd);
    fillTimer = setTimeout(proceed, FILL_IN_TIMEOUT_MS);
  }

  function runAscent(dom, dark, finish){
    dom.overlay.classList.add('ascending');
    dom.shell.classList.add('in-flight');

    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var shellSize = dom.shell.getBoundingClientRect().width;

    var travelY = -(vh / 2 + shellSize);
    var driftX = -Math.min(60, vw * 0.06);
    
    var faviconSwapped = false;
    var startTime = performance.now();
    var DURATION = 1600;

    function easeExpoInOut(t) {
        if (t === 0) return 0;
        if (t === 1) return 1;
        if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
        return (2 - Math.pow(2, -20 * t + 10)) / 2;
    }

    function frame(now){
      var elapsed = now - startTime;
      var rawP = Math.min(elapsed / DURATION, 1);
      
      var p = easeExpoInOut(rawP);
      
      var y = travelY * p;
      var x = driftX * p;
      var scale = 1;
      if (rawP < 0.15) {
          scale = 1 + (0.06 * (rawP / 0.15));
      } else {
          var shrinkP = (rawP - 0.15) / 0.85;
          scale = 1.06 - (1.06 - 0.12) * easeExpoInOut(shrinkP);
      }
      var opacity = rawP < 0.8 ? 1 : 1 - ((rawP - 0.8) / 0.2);

      dom.shell.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + scale.toFixed(4) + ')';
      dom.shell.style.opacity = String(Math.max(0, Math.min(1, opacity)));

      if (!faviconSwapped && rawP >= 0.85) {
        faviconSwapped = true;
        revealFavicon(dark);
      }

      if (rawP >= 1) {
        if (!faviconSwapped) revealFavicon(dark);
        
        var pulse = document.createElement('div');
        pulse.className = 'airdrop-ring';
        pulse.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
        dom.overlay.appendChild(pulse);
        
        setTimeout(function() {
            unmount(dom, finish);
        }, 400);
      } else {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  function revealFavicon(dark){
    if (typeof window.DHCMark.bounceFavicon === 'function') {
      window.DHCMark.bounceFavicon(dark);
    } else {
      window.DHCMark.updateFavicon(dark);
    }
  }

  function unmount(dom, finish){
    window.DHCMark.suppressAutoUpdate = false;
    if (dom.overlay.parentNode) dom.overlay.parentNode.removeChild(dom.overlay);
    finish();
  }

  window.DHCGlassLoader = { play: play };
})();
