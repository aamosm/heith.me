

(function () {
  "use strict";


  const STYLE = document.createElement("style");
  STYLE.textContent = `
    

    
    html.blob-cursor,
    html.blob-cursor * {
      cursor: none !important;
    }

    
    #xeno-blob {
      position: fixed;
      top: 0;
      left: 0;
      width: 16px;
      height: 16px;
      margin: -8px 0 0 -8px;

      
      background: #fff;
      mix-blend-mode: difference;
      
      -webkit-backdrop-filter: blur(0px);
      backdrop-filter: blur(0px);

      
      border-radius: 47% 53% 52% 48% / 55% 49% 51% 45%;

      z-index: 99999;
      pointer-events: none;
      opacity: 0;
      will-change: transform, border-radius;

      
      animation: xenoBlobMorph 3.2s ease-in-out infinite;
    }

    
    @keyframes xenoBlobMorph {
      0%, 100% { border-radius: 47% 53% 52% 48% / 55% 49% 51% 45%; }
      33%      { border-radius: 58% 42% 45% 55% / 42% 58% 42% 58%; }
      66%      { border-radius: 42% 58% 60% 40% / 52% 44% 56% 48%; }
    }

    
    html.blob-cursor #xeno-blob.blob--hover {
      width: 28px;
      height: 28px;
      margin: -14px 0 0 -14px;
      transition: width 0.25s ease, height 0.25s ease, margin 0.25s ease;
    }

    
    #xeno-blob { animation-play-state: paused; }
    html.blob-cursor #xeno-blob { animation-play-state: running; }
  `;
  document.head.appendChild(STYLE);
  const blob = document.createElement("div");
  blob.id = "xeno-blob";
  document.body.appendChild(blob);
  const M = { x: -9999, y: -9999, active: false, press: false };

  var cursorFrame = 0;
  function wake(){
    if (!cursorFrame && !document.hidden) cursorFrame = requestAnimationFrame(blobLoop);
  }

  addEventListener("pointermove", function (e) {
    if (e.pointerType === 'touch') { leave(); return; }
    if (
      e.clientX >= document.documentElement.clientWidth ||
      e.clientY >= document.documentElement.clientHeight ||
      e.clientX <= 0 ||
      e.clientY <= 0
    ) {
      leave();
      return;
    }
    if (!M.active) { bx = bpx = e.clientX; by = bpy = e.clientY; }
    M.x = e.clientX;
    M.y = e.clientY;
    M.active = true;
    document.documentElement.classList.add("blob-cursor");
    wake();
  }, { passive: true });

  var leave = function () {
    M.active = false;
    M.press = false;
    M.x = -9999;
    M.y = -9999;
    blob.style.opacity = "0";
    document.documentElement.classList.remove("blob-cursor");
    cancelAnimationFrame(cursorFrame);
    cursorFrame = 0;
  };

  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget && !e.toElement) leave();
  });
  document.addEventListener("mouseleave", leave);
  addEventListener("blur", leave);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) leave();
  });

  addEventListener("pointerdown", function (e) {
    if (e.pointerType === 'touch') { leave(); return; }
    if (!M.active) { bx = bpx = e.clientX; by = bpy = e.clientY; }
    document.documentElement.classList.add("blob-cursor");
    M.x = e.clientX;
    M.y = e.clientY;
    M.active = true;
    M.press = true;
    wake();
  });
  addEventListener("pointerup", function () {
    M.press = false;
    if (M.active) wake();
  });

  var hoverTargets = "a, button, [role='button'], input, textarea, select, label, [onclick], summary";
  var isHovering = false;

  document.addEventListener("mouseover", function (e) {
    if (e.target.closest && e.target.closest(hoverTargets)) {
      if (!isHovering) {
        isHovering = true;
        blob.classList.add("blob--hover");
      }
    }
  });
  document.addEventListener("mouseout", function (e) {
    var target = e.target.closest ? e.target.closest(hoverTargets) : null;
    var related = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(hoverTargets) : null;
    if (target && !related) {
      isHovering = false;
      blob.classList.remove("blob--hover");
    }
  });













  var bx = M.x;
  var by = M.y;
  var bpx = bx;
  var bpy = by;

  function blobLoop() {
    cursorFrame = 0;
    var on = M.active && M.x > -9000;
    blob.style.opacity = on ? "1" : "0";

    if (on) {

      var settled = Math.abs(M.x - bx) < 0.01 && Math.abs(M.y - by) < 0.01;
      bx = settled ? M.x : bx + (M.x - bx) * 0.32;
      by = settled ? M.y : by + (M.y - by) * 0.32;

      var vx = bx - bpx;
      var vy = by - bpy;
      bpx = bx;
      bpy = by;

      var sp = Math.hypot(vx, vy);
      var stretch = Math.min(0.9, sp * 0.05);

      var ang = (Math.atan2(vy, vx) * 180) / Math.PI;

      var scale = M.press ? 0.6 : 1;

      blob.style.transform =
        "translate(" + bx + "px, " + by + "px) rotate(" + ang + "deg) " +
        "scale(" + (scale * (1 + stretch)) + ", " + (scale * (1 - stretch * 0.6)) + ")";
    }

    if (on && !settled) wake();
  }
})();
