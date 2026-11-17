// Corner menu: two sheets of paper drop from the top right and lead to the other pages.
(function () {
  'use strict';

  const DHC = window.DHC;
  const trigger = document.querySelector('.menu-trigger');
  const pages = [
    { id: 'projects', path: 'projects/', label: 'Projects', color: 'var(--paper-green)' },
    { id: 'design', path: 'site-design/', label: 'Design', color: 'var(--paper-mauve)' },
    { id: 'devlogs', path: 'devlogs/', label: 'Devlogs', color: 'var(--paper-brown)' }
  ];
  const here = pages.findIndex(page => page.id === document.documentElement.dataset.page);
  if (!trigger || here < 0) return;

  const menu = document.createElement('nav');
  menu.id = 'corner-menu';
  menu.className = 'corner-menu';
  menu.setAttribute('aria-label', 'Other pages');
  menu.inert = true;

  const others = [pages[(here + 1) % pages.length], pages[(here + pages.length - 1) % pages.length]];
  const sheets = others.map((page, index) => {
    const sheet = document.createElement('a');
    const dest = new URL(page.path, DHC.base);
    dest.searchParams.set('v', 'd');
    sheet.href = dest.href;
    sheet.className = 'menu-sheet menu-sheet--' + (index === 0 ? 'wide' : 'tall');
    sheet.style.setProperty('--bg', page.color);
    sheet.innerHTML = '<span class="menu-sheet-body"><span class="fray"></span>' +
      '<span class="paper"><span class="menu-sheet-label"></span></span></span>';
    sheet.querySelector('.menu-sheet-label').textContent = page.label;
    menu.appendChild(sheet);
    return sheet;
  });

  // Right after the button, so Tab walks from it into the sheets and out again.
  trigger.after(menu);
  trigger.setAttribute('aria-controls', menu.id);
  trigger.setAttribute('aria-expanded', 'false');

  // Torn bottom edges, sized to the sheet.
  function tearEdges() {
    sheets.forEach((sheet, index) => {
      const teeth = Math.max(1, Math.ceil(sheet.offsetWidth / 30));
      const fray = ['0% 0%', '100% 0%'];
      const solid = ['0% 0%', '100% 0%'];
      for (let i = teeth; i >= 0; i--) {
        const x = (i / teeth * 100).toFixed(3);
        const rag = 20 + Math.sin(i * 1.8 + index) * 12 + Math.sin(i * 3.4 + index) * 6;
        fray.push(`${x}% calc(100% - ${rag.toFixed(2)}px)`);
        solid.push(`${x}% calc(100% - ${(rag + 10 + Math.sin(i * 2.7 + index * 2) * 6).toFixed(2)}px)`);
      }
      sheet.style.setProperty('--fray-edge', `polygon(${fray.join(',')})`);
      sheet.style.setProperty('--paper-edge', `polygon(${solid.join(',')})`);
    });
  }
  tearEdges();
  new ResizeObserver(tearEdges).observe(menu);

  const pointer = { x: -1, y: -1 };
  const timers = new Set();
  let open = false;
  let pinned = false;        // opened by a click, a tap or the keyboard: stays until dismissed
  let hoverBlocked = false;  // just closed by a click: wait for the pointer to leave before hover reopens it
  let closeTimer = 0;
  let scrollAtOpen = 0;
  let front = sheets[0];
  let settling = false;
  let swapping = false;
  front.classList.add('is-front');

  const inside = target => target instanceof Node && (trigger.contains(target) || menu.contains(target));
  const sheetAt = target => (target instanceof Element ? target.closest('.menu-sheet') : null);

  function later(run, ms) {
    const id = setTimeout(() => { timers.delete(id); run(); }, ms);
    timers.add(id);
  }

  // The sheet under the pointer lifts, then drops back in front of the other.
  function raise(sheet) {
    if (!open || !sheet || sheet === front || settling || swapping) return;
    swapping = true;
    sheet.classList.add('is-lifting');
    later(() => {
      front.classList.remove('is-front');
      sheet.classList.add('is-front');
      front = sheet;
    }, 115);
    later(() => sheet.classList.remove('is-lifting'), 225);
    later(() => {
      swapping = false;
      raise(sheetAt(document.elementFromPoint(pointer.x, pointer.y)));
    }, 650);
  }

  function holdOpen() {
    clearTimeout(closeTimer);
    closeTimer = 0;
  }

  function openMenu(pin) {
    holdOpen();
    pinned = pinned || pin;
    if (open) return;
    open = true;
    scrollAtOpen = window.scrollY;
    menu.inert = false;
    menu.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    settling = true;
    later(() => {
      settling = false;
      raise(sheetAt(document.elementFromPoint(pointer.x, pointer.y)));
    }, 620);
  }

  function closeMenu() {
    holdOpen();
    if (!open) return;
    open = pinned = settling = swapping = false;
    timers.forEach(clearTimeout);
    timers.clear();
    sheets.forEach(sheet => sheet.classList.remove('is-lifting'));
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    menu.inert = true;
  }

  // A short grace period, so crossing the gap between button and sheet does not close it.
  function closeSoon() {
    if (!open || pinned || closeTimer) return;
    closeTimer = setTimeout(() => {
      closeTimer = 0;
      if (!pinned && !inside(document.elementFromPoint(pointer.x, pointer.y))) closeMenu();
    }, 120);
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const onTrigger = trigger.contains(event.target);
    if (!onTrigger) hoverBlocked = false;
    if (!open) {
      if (onTrigger && !hoverBlocked) openMenu(false);
      return;
    }
    if (inside(event.target)) {
      holdOpen();
      raise(sheetAt(event.target));
    } else {
      closeSoon();
    }
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    if (event.relatedTarget || event.pointerType === 'touch') return;
    pointer.x = pointer.y = -1;
    closeSoon();
  }, { passive: true });

  trigger.addEventListener('click', event => {
    if (!open) {
      openMenu(true);
      if (event.detail === 0) sheets[0].focus({ preventScroll: true });
    } else if (!pinned) {
      pinned = true;
      holdOpen();
    } else {
      closeMenu();
      hoverBlocked = true;
    }
  });

  // The sheets land on top of the button. A click that was meant for it keeps the menu open instead of following a link.
  menu.addEventListener('click', event => {
    if (!settling) return;
    event.preventDefault();
    pinned = true;
  });

  document.addEventListener('pointerdown', event => {
    if (open && !inside(event.target)) closeMenu();
  }, { capture: true, passive: true });

  trigger.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    openMenu(true);
    sheets[0].focus({ preventScroll: true });
  });
  menu.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    sheets[(sheets.indexOf(document.activeElement) + step + sheets.length) % sheets.length].focus({ preventScroll: true });
  });
  sheets.forEach(sheet => sheet.addEventListener('focus', () => raise(sheet)));

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !open) return;
    const hadFocus = menu.contains(document.activeElement);
    closeMenu();
    if (hadFocus) trigger.focus({ preventScroll: true });
  });
  document.addEventListener('focusin', event => {
    if (open && !inside(event.target)) closeMenu();
  });

  // A pinned menu steps aside once the page has clearly moved on.
  window.addEventListener('scroll', () => {
    if (!open || !pinned || menu.contains(document.activeElement)) return;
    if (Math.abs(window.scrollY - scrollAtOpen) > 48) closeMenu();
  }, { passive: true });
  window.addEventListener('blur', closeMenu);
  window.addEventListener('pageshow', closeMenu);
  document.addEventListener('visibilitychange', () => { if (document.hidden) closeMenu(); });
})();
