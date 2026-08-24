/**
 * Cursor mechanic inspired by / adapted from:
 *   Xenobiota by tol-is  ·  https://github.com/tol-is/xenobiota
 *   Live demo: https://xenobiota.vercel.app
 * 
 * added additional features: like repositioning when cursor goes off screen, and hover detection for interactive elements
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  "use strict";

  if (window.matchMedia("(pointer: coarse)").matches) return;

  const STYLE = document.createElement("style");
  STYLE.textContent = `
    /* ── xenobiota-inspired cursor: hide native, show blob ────────────── */

    /* Hide the native cursor on ALL elements universally. */
    html.blob-cursor,
    html.blob-cursor * {
      cursor: none !important;
    }

    /* ── the blob element ────────────────────────────────────────────── */
    #xeno-blob {
      position: fixed;
      top: 0;
      left: 0;
      width: 16px;
      height: 16px;
      margin: -8px 0 0 -8px;

      /*
       * White fill + difference blend → reads as black over light backgrounds,
       * inverts to white over dark areas. Adapts to any page theme automatically.
       * (From xenobiota's original cursor styling.)
       */
      background: #fff;
      mix-blend-mode: difference;
      /* Workaround for chromium bug where mix-blend-mode vanishes over videos */
      -webkit-backdrop-filter: blur(0px);
      backdrop-filter: blur(0px);

      /* Organic blob shape — asymmetric border-radius, animated below */
      border-radius: 47% 53% 52% 48% / 55% 49% 51% 45%;

      z-index: 99999;
      pointer-events: none;
      opacity: 0;
      will-change: transform, border-radius;

      /* Slow morphing animation gives the blob an organic, living feel */
      animation: xenoBlobMorph 3.2s ease-in-out infinite;
    }

    /*
     * Keyframes for the organic border-radius morph.
     * Three waypoints cycle through subtly different blob silhouettes,
     * exactly matching the original xenobiota cursor animation.
     */
    @keyframes xenoBlobMorph {
      0%, 100% { border-radius: 47% 53% 52% 48% / 55% 49% 51% 45%; }
      33%      { border-radius: 58% 42% 45% 55% / 42% 58% 42% 58%; }
      66%      { border-radius: 42% 58% 60% 40% / 52% 44% 56% 48%; }
    }

    /* ── scale-up when hovering interactive elements ──────────────────── */
    html.blob-cursor #xeno-blob.blob--hover {
      width: 28px;
      height: 28px;
      margin: -14px 0 0 -14px;
      transition: width 0.25s ease, height 0.25s ease, margin 0.25s ease;
    }

    /* ── reduced motion: disable the morph, keep the blob static ─────── */
    @media (prefers-reduced-motion: reduce) {
      #xeno-blob {
        animation: none;
      }
    }
  `;
  document.head.appendChild(STYLE);
  const blob = document.createElement("div");
  blob.id = "xeno-blob";
  document.body.appendChild(blob);
  document.documentElement.classList.add("blob-cursor");
  const M = { x: -9999, y: -9999, active: false, press: false };

  addEventListener("mousemove", function (e) {
    if (
      e.clientX >= document.documentElement.clientWidth ||
      e.clientY >= document.documentElement.clientHeight ||
      e.clientX <= 0 ||
      e.clientY <= 0
    ) {
      leave();
      return;
    }
    M.x = e.clientX;
    M.y = e.clientY;
    M.active = true;
  });

  var leave = function () {
    M.active = false;
    M.press = false;
    M.x = -9999;
    M.y = -9999;
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
    M.x = e.clientX;
    M.y = e.clientY;
    M.active = true;
    M.press = true;
  });
  addEventListener("pointerup", function () {
    M.press = false;
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

  // ────────────────────────────────────────────────────────────────────────
  // Animation loop — trails the pointer, squishes with speed.
  //
  // Directly adapted from xenobiota's blobLoop:
  //   • bx/by ease toward M.x/M.y each frame (lerp factor 0.32)
  //   • velocity = current – previous frame position
  //   • speed  = hypot(vx, vy)
  //   • stretch = min(0.9, speed × 0.05)  — caps at 0.9 to avoid over-warp
  //   • rotation angle = atan2(vy, vx)     — aligns stretch to travel dir
  //   • scaleX = 1 + stretch               — elongate along travel
  //   • scaleY = 1 − stretch × 0.6         — contract perpendicular
  //   • press → scale 0.6 (squish)
  // ────────────────────────────────────────────────────────────────────────
  var bx = M.x;
  var by = M.y;
  var bpx = bx;
  var bpy = by;

  function blobLoop() {
    var on = M.active && M.x > -9000;
    blob.style.opacity = on ? "1" : "0";

    if (on) {
      // ease toward the pointer for a soft trailing lag
      bx += (M.x - bx) * 0.32;
      by += (M.y - by) * 0.32;

      // velocity since last frame
      var vx = bx - bpx;
      var vy = by - bpy;
      bpx = bx;
      bpy = by;

      // speed → stretch amount (capped)
      var sp = Math.hypot(vx, vy);
      var stretch = Math.min(0.9, sp * 0.05);

      // rotation aligns the stretch to the direction of travel
      var ang = (Math.atan2(vy, vx) * 180) / Math.PI;

      // press squish: scale contracts to 0.6 on click/hold
      var scale = M.press ? 0.6 : 1;

      blob.style.transform =
        "translate(" + bx + "px, " + by + "px) rotate(" + ang + "deg) " +
        "scale(" + (scale * (1 + stretch)) + ", " + (scale * (1 - stretch * 0.6)) + ")";
    }

    requestAnimationFrame(blobLoop);
  }

  requestAnimationFrame(blobLoop);
})();