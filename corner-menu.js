(function () {
  'use strict';

  const script = document.currentScript;
  const trigger = document.querySelector('.corner-menu-trigger');
  if (!script || !trigger || document.getElementById('dhc-corner-menu')) return;

  const siteRoot = new URL('./', script.src);
  const pages = [
    { path: 'projects/', label: 'Projects', color: '#3C4A3E' },
    { path: 'site-design/', label: 'Design', color: '#4A3752' },
    { path: 'devlogs/', label: 'Devlogs', color: '#7A6656' }
  ];
  const current = pages.find(function (page) {
    const path = new URL(page.path, siteRoot).pathname;
    return location.pathname === path.slice(0, -1) || location.pathname.startsWith(path);
  });
  if (!current) return;

  const menu = document.createElement('nav');
  menu.id = 'dhc-corner-menu';
  menu.className = 'dhc-corner-menu';
  menu.setAttribute('aria-label', 'Other pages');
  menu.setAttribute('aria-hidden', 'true');
  menu.inert = true;

  const currentIndex = pages.indexOf(current);
  const next = pages[(currentIndex + 1) % pages.length];
  const prev = pages[(currentIndex + pages.length - 1) % pages.length];
  const activePages = [next, prev];

  const sheets = activePages.map(function (page, index) {
    const sheet = document.createElement('a');
    const dest = new URL(page.path, siteRoot);
    dest.searchParams.set('v', 'd');
    sheet.href = dest.href;
    sheet.className = 'corner-paper corner-paper--' + (index === 0 ? 'wide' : 'tall');
    sheet.style.setProperty('--paper-color', page.color);
    sheet.innerHTML = '<div class="corner-paper-surface"><div class="panel-fray"></div>' +
      '<div class="panel-solid"><span class="corner-paper-label"></span></div></div>';
    sheet.querySelector('.corner-paper-label').textContent = page.label;
    menu.appendChild(sheet);
    return sheet;
  });

  document.body.appendChild(menu);
  trigger.closest('header')?.classList.add('corner-menu-header');
  trigger.setAttribute('aria-controls', menu.id);
  trigger.setAttribute('aria-expanded', 'false');

  let isOpen = false;
  let closeTimer = 0;
  let suppressFocusOpen = false;
  let pointerX = -1;
  let pointerY = -1;

  function contains(target) {
    return target instanceof Node && (trigger.contains(target) || menu.contains(target));
  }

  let frontSheet = sheets[0];
  let opening = false;
  let switching = false;
  let openTimer = 0;
  let swapTimer = 0;
  let settleTimer = 0;
  let releaseTimer = 0;
  frontSheet.classList.add('is-front');

  function bringForward(sheet) {
    if (sheet === frontSheet || opening || switching || !isOpen) return;
    switching = true;
    sheet.classList.add('is-lifting');
    swapTimer = setTimeout(function () {
      frontSheet.classList.remove('is-front');
      sheet.classList.add('is-front');
      frontSheet = sheet;
    }, 115);
    settleTimer = setTimeout(function () {
      sheet.classList.remove('is-lifting');
    }, 225);
    releaseTimer = setTimeout(function () {
      switching = false;
      const target = document.elementFromPoint(pointerX, pointerY)?.closest('.corner-paper');
      if (target && menu.contains(target)) bringForward(target);
    }, 650);
  }

  function shapeEdges() {
    sheets.forEach(function (sheet, index) {
      const count = Math.ceil(sheet.offsetWidth / 30);
      const fray = ['0% 0%', '100% 0%'];
      const solid = ['0% 0%', '100% 0%'];
      for (let i = count; i >= 0; i--) {
        const x = (i / count * 100).toFixed(3);
        const rag = 20 + Math.sin(i * 1.8 + index) * 12 + Math.sin(i * 3.4 + index) * 6;
        fray.push(x + '% calc(100% - ' + rag.toFixed(2) + 'px)');
        solid.push(x + '% calc(100% - ' + (rag + 10 + Math.sin(i * 2.7 + index * 2) * 6).toFixed(2) + 'px)');
      }
      sheet.style.setProperty('--fray-edge', 'polygon(' + fray.join(',') + ')');
      sheet.style.setProperty('--solid-edge', 'polygon(' + solid.join(',') + ')');
    });
  }
  shapeEdges();
  new ResizeObserver(shapeEdges).observe(menu);

  function cancelClose() {
    clearTimeout(closeTimer);
    closeTimer = 0;
  }

  function openMenu() {
    cancelClose();
    if (isOpen) return;
    isOpen = true;
    menu.inert = false;
    menu.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    generatePaperTexture();
    menu.classList.add('is-open');
    opening = true;
    openTimer = setTimeout(function () {
      opening = false;
      const target = document.elementFromPoint(pointerX, pointerY)?.closest('.corner-paper');
      if (target && menu.contains(target)) bringForward(target);
    }, 620);
  }

  function closeMenu() {
    cancelClose();
    isOpen = false;
    [openTimer, swapTimer, settleTimer, releaseTimer].forEach(clearTimeout);
    opening = switching = false;
    sheets.forEach(sheet => sheet.classList.remove('is-lifting'));
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    menu.inert = true;
  }

  function scheduleClose() {
    if (closeTimer) return;
    closeTimer = setTimeout(function () {
      closeTimer = 0;


      const underPointer = document.elementFromPoint(pointerX, pointerY);
      const focused = document.activeElement;
      const keyboardFocus = contains(focused) && focused.matches(':focus-visible');
      if (!contains(underPointer) && !keyboardFocus) closeMenu();
    }, 110);
  }

  trigger.addEventListener('pointerenter', function (event) {
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    openMenu();
  });
  trigger.addEventListener('pointerleave', function (event) {
    if (!contains(event.relatedTarget)) scheduleClose();
  });
  menu.addEventListener('pointerenter', cancelClose);
  menu.addEventListener('pointerleave', function (event) {
    if (!contains(event.relatedTarget)) scheduleClose();
  });

  sheets.forEach(function (sheet) {
    sheet.addEventListener('pointerenter', function (event) {
      if (event.pointerType !== 'touch') bringForward(sheet);
    });
    sheet.addEventListener('focus', () => bringForward(sheet));
  });

  document.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!isOpen) return;
    if (contains(event.target)) cancelClose();
    else scheduleClose();
  }, { passive: true });

  document.addEventListener('pointerout', function (event) {
    if (!isOpen || event.relatedTarget || event.pointerType === 'touch') return;
    pointerX = pointerY = -1;
    scheduleClose();
  });


  trigger.addEventListener('focus', function () {
    if (!suppressFocusOpen && trigger.matches(':focus-visible')) openMenu();
  });
  trigger.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ' ||
        (event.key === 'Tab' && !event.shiftKey && isOpen)) {
      event.preventDefault();
      openMenu();
      sheets[0].focus();
    }
  });
  menu.addEventListener('keydown', function (event) {
    const index = sheets.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      sheets[(index + step + sheets.length) % sheets.length].focus();
    }
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !isOpen) return;
    const returnFocus = menu.contains(document.activeElement);
    closeMenu();
    if (returnFocus) {
      suppressFocusOpen = true;
      trigger.focus({ preventScroll: true });
      suppressFocusOpen = false;
    }
  });
  document.addEventListener('focusin', function (event) {
    if (isOpen && !contains(event.target)) scheduleClose();
  });
  window.addEventListener('blur', closeMenu);
  window.addEventListener('scroll', closeMenu, { passive: true });
  window.addEventListener('pageshow', closeMenu);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) closeMenu();
  });

  function generatePaperTexture() {
    const panels = menu.querySelectorAll('.panel-fray');
    if (!panels.length || panels[0].style.backgroundImage) return;
    const textureKey = 'dhc-paper-texture-v1';
    function applyTexture(dataURL){
      panels.forEach(function(el){
        el.style.backgroundImage = 'url(' + dataURL + ')';
        el.style.backgroundSize = '300px 300px';
      });
    }

    try {
      const cached = sessionStorage.getItem(textureKey);
      if (cached && cached.startsWith('data:image/png;base64,')) {
        applyTexture(cached);
        return;
      }
    } catch (_) {}

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
    applyTexture(dataURL);
    try { sessionStorage.setItem(textureKey, dataURL); } catch (_) {}
  }
  if ('requestIdleCallback' in window) requestIdleCallback(generatePaperTexture, { timeout: 1200 });
  else setTimeout(generatePaperTexture, 0);
})();
