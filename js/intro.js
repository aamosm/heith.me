// The introduction sheet: shown on a direct visit, and again from the initials.
(function () {
  'use strict';

  const DHC = window.DHC;
  const MAIL = 'write@heith.me';

  const KEY = 'dhc-intro';

  // ?intro=name picks an entry from intros.js and is remembered for the visit.
  function chosen() {
    const all = DHC.intros || {};
    let name = new URLSearchParams(location.search).get('intro');
    try {
      if (name && Object.hasOwn(all, name)) sessionStorage.setItem(KEY, name);
      else name = sessionStorage.getItem(KEY);
    } catch (_) { /* no storage: the address alone decides */ }
    return { ...all.default, ...(name && Object.hasOwn(all, name) ? all[name] : null) };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  const paragraphs = (column, texts) => (texts || []).forEach(text => column.appendChild(el('p', '', text)));

  function build(card) {
    const intro = chosen();
    const sheet = el('div', 'intro');

    const head = el('header', 'intro-head');
    head.append(el('h2', 'intro-name', intro.name), el('p', 'intro-role', intro.role));

    const body = el('div', 'intro-body');
    const left = el('div', 'intro-col');
    const right = el('div', 'intro-col');
    paragraphs(left, intro.text);
    if (intro.list?.length) {
      if (intro.listTitle) right.appendChild(el('h3', 'intro-label', intro.listTitle));
      const list = el('dl', 'intro-list');
      intro.list.forEach(([label, text]) => {
        const row = el('div');
        row.append(el('dt', '', label), el('dd', '', text));
        list.appendChild(row);
      });
      right.appendChild(list);
    }
    paragraphs(right, intro.closing);
    const columns = [left, right].filter(column => column.childElementCount);
    body.append(...columns);
    body.classList.toggle('intro-body--single', columns.length < 2);

    const foot = el('footer', 'intro-foot');
    foot.innerHTML = `
      <div class="intro-contact">
        <button class="intro-link intro-mail" type="button" title="Click to copy">${MAIL}</button>
        <a class="intro-link" href="https://github.com/aamosm" target="_blank" rel="noopener">github/aamosm</a>
      </div>
      <div class="intro-actions">
        <span class="intro-hint">any key to continue</span>
        <button class="intro-enter" type="button" aria-label="Enter site">Enter <svg viewBox="0 0 12 19" aria-hidden="true"><path d="M6 1v15M1 11l5 5 5-5"/></svg></button>
      </div>`;

    sheet.append(head, body, foot);
    card.replaceChildren(sheet);
  }

  const fonts = DHC.loadFonts(['900 1em "Big Shoulders Display"', '400 1em "IBM Plex Sans"', '400 1em "IBM Plex Serif"']);
  // The placeholder in the markup counts as open, unless this visit skips the introduction.
  function isOpen() {
    const card = document.getElementById('intro-card');
    return !!card && !card.classList.contains('is-leaving') && !(DHC.quiet && card.hasAttribute('data-first'));
  }

  function show({ instant = true, after = Promise.resolve(), onDismiss } = {}) {
    let card = document.getElementById('intro-card');
    if (card?.dataset.bound) return card;
    if (!card) {
      card = document.createElement('div');
      card.id = 'intro-card';
      document.body.appendChild(card);
    }
    build(card);
    card.dataset.bound = 'true';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', 'Introduction');
    card.className = '';
    card.tabIndex = -1;
    card.inert = true;

    const page = document.documentElement;
    const overflow = page.style.overflow;
    page.style.overflow = 'hidden';
    DHC.scroller?.stop();
    // The page behind stops its loops and its video until the sheet is gone.
    page.classList.add('intro-open');
    document.dispatchEvent(new CustomEvent('dhc:intro', { detail: { open: true } }));

    const enter = card.querySelector('.intro-enter');
    const mail = card.querySelector('.intro-mail');
    let ready = false;
    let leaving = false;
    let heldKey = null;
    let leaveTimer = 0;

    mail.addEventListener('click', () => {
      const copied = navigator.clipboard ? navigator.clipboard.writeText(MAIL) : Promise.reject();
      copied.then(() => {
        mail.textContent = 'Copied!';
        setTimeout(() => { mail.textContent = MAIL; }, 1500);
      }, () => { location.href = 'mailto:' + MAIL; });
    });

    function close() {
      clearTimeout(leaveTimer);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      page.style.overflow = overflow;
      DHC.scroller?.start();
      card.remove();
      page.classList.remove('intro-open');
      document.dispatchEvent(new CustomEvent('dhc:intro', { detail: { open: false } }));
    }

    async function dismiss() {
      if (leaving) return;
      leaving = true;
      card.inert = true;
      if (onDismiss) {
        try { await onDismiss(); } catch (_) { /* the page still has to open */ }
      }
      requestAnimationFrame(() => {
        card.addEventListener('transitionend', event => {
          if (event.target === card && event.propertyName === 'opacity') close();
        });
        card.classList.add('is-leaving');
        leaveTimer = setTimeout(close, 600);
      });
    }
    enter.addEventListener('click', dismiss);

    // Any key lets you in. Browser keys and controls inside the sheet keep working.
    function passes(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return true;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key) || /^F\d+$/.test(event.key)) return true;
      const control = event.target instanceof Element && event.target.closest('#intro-card a, #intro-card button');
      return !!control && (event.key === 'Enter' || event.key === ' ');
    }
    function onKeyDown(event) {
      // Tab stays inside the sheet.
      if (event.key === 'Tab') {
        event.preventDefault();
        if (!ready) return;
        const stops = [mail, card.querySelector('a.intro-link'), enter];
        stops[(stops.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
        return;
      }
      if (passes(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (ready && !leaving && !event.repeat && heldKey === null) heldKey = event.code || event.key;
    }
    // Leave on release, so a key held down from before the sheet opened does nothing.
    function onKeyUp(event) {
      if (heldKey === null || (event.code || event.key) !== heldKey) return;
      event.preventDefault();
      event.stopPropagation();
      heldKey = null;
      dismiss();
    }
    function onBlur() { heldKey = null; }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);

    const reveal = () => {
      if (!card.isConnected || leaving) return;
      card.removeAttribute('data-first');
      card.inert = false;
      card.classList.toggle('is-instant', instant);
      card.classList.add('is-ready');
      ready = true;
      card.focus({ preventScroll: true });
    };
    Promise.all([fonts, after]).then(reveal, reveal);

    return card;
  }

  DHC.intro = { show, isOpen };

  // First paint of a page: straight in for links from inside the site, the full welcome otherwise.
  DHC.enter = function ({ onDismiss } = {}) {
    if (DHC.quiet) {
      document.querySelector('#intro-card[data-first]')?.remove();
      DHC.scroller?.start();
      DHC.mark.show();
      return false;
    }
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flown = calm ? Promise.resolve(false) : DHC.loader.play();
    flown.then(flew => { if (!flew) DHC.mark.pop(); });
    show({ instant: false, after: flown, onDismiss });
    return true;
  };
})();
