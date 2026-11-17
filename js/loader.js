// The glass tile that carries the signature up into the browser tab.
(function () {
  'use strict';

  const DHC = window.DHC;
  const READY_LIMIT = 900;
  const SETTLE_LIMIT = 700;
  const FLIGHT = 1600;

  const expoInOut = t => (t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);

  function fly(done) {
    const overlay = document.createElement('div');
    overlay.id = 'glass-loader';
    const shell = document.createElement('div');
    shell.className = 'glass-shell';
    const canvas = document.createElement('canvas');
    canvas.className = 'glass-mark';
    canvas.width = canvas.height = 200;
    shell.appendChild(canvas);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);

    DHC.mark.hold = true;
    DHC.mark.render(canvas);

    function ascend() {
      overlay.classList.add('ascending');
      const lift = -(window.innerHeight / 2 + shell.getBoundingClientRect().width);
      const drift = -Math.min(60, window.innerWidth * .06);
      const start = performance.now();
      let popped = false;

      (function frame(now) {
        const raw = Math.min((now - start) / FLIGHT, 1);
        const p = expoInOut(raw);
        const scale = raw < .15 ? 1 + .06 * (raw / .15) : 1.06 - .94 * expoInOut((raw - .15) / .85);
        shell.style.transform = `translate3d(${(drift * p).toFixed(2)}px, ${(lift * p).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
        shell.style.opacity = raw < .8 ? '1' : String(1 - (raw - .8) / .2);

        // The tab icon appears just as the tile reaches it.
        if (!popped && raw >= .85) {
          popped = true;
          DHC.mark.pop();
        }
        if (raw < 1) {
          requestAnimationFrame(frame);
          return;
        }
        DHC.mark.hold = false;
        overlay.remove();
        done();
      })(start);
    }

    // Let the tile land before it takes off.
    let settled = false;
    const settle = event => {
      if (settled || (event && (event.target !== shell || event.propertyName !== 'transform'))) return;
      settled = true;
      clearTimeout(timer);
      shell.removeEventListener('transitionend', settle);
      ascend();
    };
    shell.addEventListener('transitionend', settle);
    const timer = setTimeout(settle, SETTLE_LIMIT);
    void shell.offsetWidth;
    requestAnimationFrame(() => overlay.classList.add('in'));
  }

  DHC.loader = {
    // Resolves true once the flight has finished, false if it was skipped.
    play() {
      return new Promise(resolve => {
        let finished = false;
        const finish = flew => {
          if (finished) return;
          finished = true;
          clearTimeout(wait);
          resolve(flew);
        };
        const wait = setTimeout(() => finish(false), READY_LIMIT);
        DHC.mark.ready.then(ok => {
          if (finished) return;
          if (!ok) { finish(false); return; }
          clearTimeout(wait);
          fly(() => finish(true));
        });
      });
    }
  };
})();
