// The introduction sheet: shown on a direct visit, and again from the initials.
(function () {
  'use strict';

  const DHC = window.DHC;
  const MAIL = 'write@heith.me';

  const MARKUP = `
    <div class="intro">
      <header class="intro-head">
        <h2 class="intro-name"><span>Dhruv</span> <span>Heith</span> <span>Chheda</span></h2>
        <p class="intro-role">Mauritian · Interdisciplinary student</p>
      </header>
      <div class="intro-letter">
        <p>I’m interested in games and the tools people use to make them. I enjoy programming, and I’d like a hand in the writing, visual decisions and coordination behind a project too. Working with a team appeals to me because there’s more than one way to contribute.</p>
        <p>I grew up playing GBA games on a laptop, and older games and emulation remain personal interests. I also like films that say a lot through simple choices. That’s something I’d like to explore in my own work.</p>
        <p>I’m usually up for a project or a competition, especially with teammates. Some of my projects started with someone around me needing something; others were ideas I wanted to try. I’ve worked independently, with school teams and during a robotics internship at IIT Gandhinagar.</p>
        <h3 class="intro-label">Some of the tools I’ve worked with</h3>
        <dl class="intro-tools">
          <div><dt>Games</dt><dd>Godot and GDScript; currently learning Unity and C#.</dd></div>
          <div><dt>Visual work</dt><dd>Blender, Aseprite and After Effects.</dd></div>
          <div><dt>Programming</dt><dd>Python, C++ and JavaScript, with Git/GitHub for managing projects.</dd></div>
          <div><dt>CAD</dt><dd>SolidWorks.</dd></div>
        </dl>
        <p>I’m open to internships and collaborations across programming, design and game production. You’re always welcome to contact me for a detailed CV, more about my work, or a project you’d like to discuss.</p>
      </div>
      <footer class="intro-foot">
        <div class="intro-contact">
          <button class="intro-link intro-mail" type="button" title="Click to copy">${MAIL}</button>
          <a class="intro-link" href="https://github.com/aamosm" target="_blank" rel="noopener">github/aamosm</a>
        </div>
        <div class="intro-actions">
          <button class="intro-enter" type="button" aria-label="Enter site">Enter <svg viewBox="0 0 12 19" aria-hidden="true"><path d="M6 1v15M1 11l5 5 5-5"/></svg></button>
          <span class="intro-hint">any key to continue</span>
        </div>
      </footer>
    </div>`;

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
    card.innerHTML = MARKUP;
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
