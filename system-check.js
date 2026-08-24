(function () {
  try {
    var c = navigator.connection;
    var lowData = !!(c && (c.saveData || /2g/.test(c.effectiveType || '')));
    var lite =
      lowData ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

    var hwAccel = false;

    try {
      var canvas = document.createElement('canvas');
      var gl =
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');

      if (gl) {
        var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

        if (debugInfo) {
          var renderer = gl
            .getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            .toLowerCase();

          var softwarePatterns = [
            'swiftshader',
            'llvmpipe',
            'softpipe',
            'software',
            'microsoft basic render',
            'basic render driver',
            'warp',
            'vmware svga',
            'virtualbox',
            'parallels',
            'virgl',
            'lavapipe'
          ];

          var isSoftware = false;
          for (var i = 0; i < softwarePatterns.length; i++) {
            if (renderer.indexOf(softwarePatterns[i]) !== -1) {
              isSoftware = true;
              break;
            }
          }

          hwAccel = !isSoftware;
        }

        var loseCtx = gl.getExtension('WEBGL_lose_context');
        if (loseCtx) loseCtx.loseContext();
      }
    } catch (e) {}

    var docEl = document.documentElement;

    if (lite) {
      docEl.classList.add('lite-mode', 'lite');
    } else if (!hwAccel) {
      docEl.classList.add('compat-mode');
    } else {
      docEl.classList.add('high-perf-mode');
    }

    window.__DHC_LOWDATA__ = lowData;
    window.__DHC_LITE__ = !!lite;
    window.__DHC_HWACCEL__ = hwAccel;

    if (!lowData) {
      var preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'video';
      preloadLink.href = lite ? './assets/finalcompressedver2_lite.mp4' : './assets/finalcompressedver2.mp4';
      document.head.appendChild(preloadLink);
    }
  } catch (e) {
    document.documentElement.classList.add('compat-mode');
    window.__DHC_LOWDATA__ = false;
    window.__DHC_LITE__ = false;
    window.__DHC_HWACCEL__ = false;
  }
})();