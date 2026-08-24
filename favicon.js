(function(){
  var CANVAS_SIZE = 64;
  var EDGE_MARGIN = 4;
  var WORK_RATIO = 4;
  var THICKNESS = 1.4;
  var SOFT_BLUR_PX = 1.2;
  var SCRIPT_URL = (document.currentScript && document.currentScript.src) || './favicon.js';
  var IMAGE_PATH = new URL('./assets/favicon.png', SCRIPT_URL).href;

  var cropCanvas = null;
  var cropWidth = 0;
  var cropHeight = 0;

  var hasShownFavicon = false;

  var readyResolve;
  var readyPromise = new Promise(function(res){ readyResolve = res; });

  function prefersDark(){
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function loadImage(){
    var img = new Image();

    img.onload = function(){
      var source = document.createElement('canvas');
      source.width = img.naturalWidth;
      source.height = img.naturalHeight;

      var sourceCtx = source.getContext('2d', { willReadFrequently: true });
      sourceCtx.drawImage(img, 0, 0);

      var data;
      try {
        data = sourceCtx.getImageData(0, 0, source.width, source.height).data;
      } catch (err) {
        console.warn('[DHCMark] could not read favicon.png pixel data', err);
        readyResolve(false);
        return;
      }

      var minX = source.width, minY = source.height, maxX = -1, maxY = -1;

      for (var y = 0; y < source.height; y++) {
        for (var x = 0; x < source.width; x++) {
          if (data[(y * source.width + x) * 4 + 3] > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        console.warn('[DHCMark] favicon.png loaded but has no opaque pixels');
        readyResolve(false);
        return;
      }

      cropWidth = maxX - minX + 1;
      cropHeight = maxY - minY + 1;

      cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;

      cropCanvas.getContext('2d').drawImage(
        source, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight
      );

      readyResolve(true);
    };

    img.onerror = function(){
      console.warn('[DHCMark] failed to load ' + IMAGE_PATH);
      readyResolve(false);
    };

    img.src = IMAGE_PATH;
  }

  function computeGeometry(size){
    var scaleFactor = size / CANVAS_SIZE;
    var workScale = WORK_RATIO;
    var workSize = size * workScale;

    var marginPx = EDGE_MARGIN * scaleFactor;
    var available = size - marginPx * 2;
    var fitScale = Math.min(available / cropWidth, available / cropHeight);

    var drawWidth = cropWidth * fitScale;
    var drawHeight = cropHeight * fitScale;
    var scaledWidth = drawWidth * workScale;
    var scaledHeight = drawHeight * workScale;

    var x = (workSize - scaledWidth) / 2;
    var yNudge = 2 * scaleFactor * workScale; 
    var y = (workSize - scaledHeight) / 2 + yNudge;

    var thicknessRadius = THICKNESS * scaleFactor * workScale;

    return {
      workSize: workSize, x: x, y: y,
      scaledWidth: scaledWidth, scaledHeight: scaledHeight,
      thicknessRadius: thicknessRadius,
      scaleFactor: scaleFactor, workScale: workScale
    };
  }

  function drawSoftInto(ctx, geom, resolve){
    var blur = SOFT_BLUR_PX * geom.scaleFactor * geom.workScale * (1 - resolve);
    ctx.save();
    if (blur > 0.05) ctx.filter = 'blur(' + blur.toFixed(2) + 'px)';
    ctx.drawImage(cropCanvas, geom.x, geom.y, geom.scaledWidth, geom.scaledHeight);
    ctx.restore();
  }

  function drawCrispInto(ctx, geom, dark){
    var mask = document.createElement('canvas');
    mask.width = geom.workSize;
    mask.height = geom.workSize;

    var maskCtx = mask.getContext('2d');
    maskCtx.imageSmoothingEnabled = true;
    maskCtx.imageSmoothingQuality = 'high';
    maskCtx.drawImage(cropCanvas, geom.x, geom.y, geom.scaledWidth, geom.scaledHeight);

    var radius = geom.thicknessRadius;
    var steps = Math.max(8, Math.ceil(radius * 8));

    for (var i = 0; i < steps; i++) {
      var angle = (Math.PI * 2 * i) / steps;
      ctx.drawImage(mask, Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.drawImage(mask, 0, 0);

    var imageData = ctx.getImageData(0, 0, geom.workSize, geom.workSize);
    var pixels = imageData.data;

    var targetR = dark ? 255 : 0;
    var targetG = dark ? 255 : 0;
    var targetB = dark ? 255 : 0;

    for (var p = 0; p < pixels.length; p += 4) {
      if (pixels[p+3] > 30) {
          pixels[p] = targetR;
          pixels[p + 1] = targetG;
          pixels[p + 2] = targetB;
          pixels[p + 3] = 255;
      } else {
          pixels[p + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  var crispCache = {};

  function getCrispCanvas(geom, dark){
    var key = geom.workSize + '_' + (dark ? 1 : 0);
    var cached = crispCache[key];
    if (cached) return cached;

    var canvas = document.createElement('canvas');
    canvas.width = geom.workSize;
    canvas.height = geom.workSize;
    drawCrispInto(canvas.getContext('2d'), geom, dark);

    crispCache[key] = canvas;
    return canvas;
  }

  var workCanvasPool = {};

  function getWorkCanvas(size, workSize){
    var canvas = workCanvasPool[size];
    if (!canvas) {
      canvas = document.createElement('canvas');
      workCanvasPool[size] = canvas;
    }
    if (canvas.width !== workSize) canvas.width = workSize;
    if (canvas.height !== workSize) canvas.height = workSize;
    return canvas;
  }

  function renderMark(targetCtx, size, opts){
    if (!cropCanvas) return false;

    var geom = computeGeometry(size);
    var work = getWorkCanvas(size, geom.workSize);

    var workCtx = work.getContext('2d');
    workCtx.imageSmoothingEnabled = true;
    workCtx.imageSmoothingQuality = 'high';
    workCtx.clearRect(0, 0, geom.workSize, geom.workSize);

    var resolve = Math.max(0, Math.min(1, opts.resolve == null ? 1 : opts.resolve));
    var dark = !!opts.dark;

    if (resolve >= 0.999) {
      workCtx.drawImage(getCrispCanvas(geom, dark), 0, 0);
    } else {
      drawSoftInto(workCtx, geom, resolve);
      if (resolve > 0.001) {
        workCtx.globalAlpha = resolve;
        workCtx.drawImage(getCrispCanvas(geom, dark), 0, 0);
        workCtx.globalAlpha = 1;
      }
    }

    targetCtx.clearRect(0, 0, size, size);

    var bounceScale = opts.bounceScale == null ? 1 : opts.bounceScale;

    if (bounceScale === 1) {
      targetCtx.drawImage(work, 0, 0, geom.workSize, geom.workSize, 0, 0, size, size);
    } else {
      targetCtx.globalAlpha = Math.max(0, Math.min(1, bounceScale));
      var destSize = size * bounceScale;
      var destOffset = (size - destSize) / 2;
      targetCtx.drawImage(work, 0, 0, geom.workSize, geom.workSize, destOffset, destOffset, destSize, destSize);
      targetCtx.globalAlpha = 1;
    }
    return true;
  }

  function paintFavicon(dark, bounceScale){
    if (!cropCanvas) return false;

    var canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (!renderMark(ctx, CANVAS_SIZE, { resolve: 1, dark: dark, bounceScale: bounceScale })) return false;

    var link = document.querySelector("link[rel='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');

    if (!link.parentNode) {
      document.head.appendChild(link);
    }

    hasShownFavicon = true;
    return true;
  }

  function updateFavicon(dark){
    paintFavicon(dark, 1);
  }

  function bounceFavicon(dark){
    if (!cropCanvas) { updateFavicon(dark); return; }

    var STEPS = 16;
    var DURATION_MS = 800;
    var i = 0;

    function popCurve(t) {
        return 1 - Math.exp(-6 * t) * Math.cos(9 * t);
    }

    function step(){
      var t = i / (STEPS - 1);
      var scale = (i === STEPS - 1) ? 1 : Math.max(0.001, popCurve(t));
      paintFavicon(dark, scale);
      i++;
      if (i < STEPS) setTimeout(step, DURATION_MS / (STEPS - 1));
    }

    step();
  }

  var DHCMark = {
    ready: readyPromise,
    isReady: function(){ return !!cropCanvas; },
    render: function(canvasEl, opts){
      opts = opts || {};
      var size = canvasEl.width;
      var ctx = canvasEl.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      return renderMark(ctx, size, opts);
    },
    updateFavicon: updateFavicon,
    bounceFavicon: bounceFavicon,
    suppressAutoUpdate: false
  };

  window.DHCMark = DHCMark;

  loadImage();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e){
    if (DHCMark.suppressAutoUpdate || !hasShownFavicon) return;
    updateFavicon(e.matches);
  });
})();