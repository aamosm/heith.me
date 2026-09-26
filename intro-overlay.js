(function () {
  'use strict';

  const INTRO_MARKUP = '<div id="intro-card" aria-label="Introduction">' +
    '<div class="intro-dots" id="introDots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>' +
    '<div class="intro-content">' +
      '<h1 class="intro-name">Dhruv Heith Chheda</h1>' +
      '<p class="intro-sub">Mauritian · Interdisciplinary student</p>' +
      '<div class="intro-body">' +
        '<p>I\'m interested in games and the tools people use to make them. I enjoy programming, and I\'d like a hand in the writing, visual decisions and coordination behind a project too. Working with a team appeals to me because there\'s more than one way to contribute.</p>' +
        '<p>I grew up playing GBA games on a laptop, and older games and emulation remain personal interests. I also like films that say a lot through simple choices. That\'s something I\'d like to explore in my own work.</p>' +
        '<p>I\'m usually up for a project or a competition, especially with teammates. Some of my projects started with someone around me needing something; others were ideas I wanted to try. I\'ve worked independently, with school teams and during a robotics internship at IIT Gandhinagar.</p>' +
        '<p class="intro-tools-heading">Some of the tools I\'ve worked with</p>' +
        '<ul class="intro-tools">' +
          '<li><strong>Games:</strong> Godot and GDScript; currently learning Unity and C#.</li>' +
          '<li><strong>Visual work:</strong> Blender, Aseprite and After Effects.</li>' +
          '<li><strong>Programming:</strong> Python, C++ and JavaScript, with Git/GitHub for managing projects.</li>' +
          '<li><strong>CAD:</strong> SolidWorks.</li>' +
        '</ul>' +
        '<p>I\'m open to internships and collaborations across programming, design and game production. You\'re always welcome to contact me for a detailed CV, more about my work, or a project you\'d like to discuss.</p>' +
      '</div>' +
      '<div class="intro-footer">' +
        '<div class="intro-links">' +
          '<span class="intro-link copyable-email">write@heith.me</span>' +
          '<a href="https://github.com/aamosm" target="_blank" rel="noopener" class="intro-link">github/aamosm</a>' +
        '</div>' +
        '<div class="intro-actions">' +
          '<button class="intro-skip" type="button" aria-label="Enter site">Enter &darr;</button>' +
          '<div class="intro-hint">any key to continue</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  const introFontsReady = document.fonts ? Promise.allSettled([
    document.fonts.load('900 52px "Big Shoulders Display"', 'Dhruv Heith Chheda'),
    document.fonts.load('400 14px "IBM Plex Sans"'),
    document.fonts.load('500 13px "IBM Plex Sans"'),
    document.fonts.load('600 14px "IBM Plex Sans"')
  ]).then(() => document.fonts.ready) : Promise.resolve();

  function getScroller() {
    return window.DHCSite?.scroller || window.DHCLenis || null;
  }

  window.showIntroOverlay = function (instant = true, animationDone = Promise.resolve(), onDismiss) {
    let card = document.getElementById('intro-card');

    if (card?.dataset.introBound === 'true') {
      return card;
    }

    if (!card) {
      const holder = document.createElement('div');
      holder.innerHTML = INTRO_MARKUP;
      card = holder.firstElementChild;
      document.body.appendChild(card);
    } else if (!card.querySelector('.intro-content')) {
      const holder = document.createElement('div');
      holder.innerHTML = INTRO_MARKUP;
      card.replaceChildren(...holder.firstElementChild.childNodes);
    }

    card.dataset.introBound = 'true';
    card.inert = true;
    card.classList.remove('instant-text', 'text-ready', 'exit');

    const isRoot = document.querySelector('meta[name="dhc-site-root"]') !== null;
    const isLight = isRoot && !window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isRoot) {
      const bg = isLight ? '#F5F0E8' : '#1A1A18';
      card.style.setProperty('background', bg);
      card.style.setProperty('--ink-on-loader', isLight ? '#1A1A18' : '#F0EBE3');
      card.style.setProperty('--ink', isLight ? '#1A1A18' : '#F0EBE3');
      card.style.setProperty('--muted', isLight ? 'rgba(26,26,24,0.5)' : 'rgba(244,246,248,0.55)');
      card.classList.toggle('intro-light-theme', isLight);
    }

    const dots = card.querySelector('.intro-dots');
    if (dots) dots.style.display = 'none';

    const oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    const scroller = getScroller();
    if (scroller && typeof scroller.stop === 'function') scroller.stop();

    const mail = card.querySelector('.copyable-email');
    if (mail) {
      mail.style.cursor = 'pointer';
      mail.title = 'Click to copy';
      mail.onclick = function () {
        navigator.clipboard?.writeText('write@heith.me').catch(() => {});
        const old = mail.textContent;
        mail.textContent = 'Copied!';
        setTimeout(() => {
          if (mail.isConnected) mail.textContent = old;
        }, 1500);
      };
    }

    let dismissed = false;
    let ready = false;
    let pendingKey = null;
    let exitTimer = 0;
    let finished = false;

    function finishDismiss() {
      if (finished) return;
      finished = true;
      clearTimeout(exitTimer);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      card.removeEventListener('transitionend', onExitEnd);
      const currentScroller = getScroller();
      if (currentScroller && typeof currentScroller.start === 'function') currentScroller.start();
      document.documentElement.style.overflow = oldOverflow;
      card.remove();
    }

    function onExitEnd(event) {
      if (event.target === card && event.propertyName === 'opacity') finishDismiss();
    }

    async function dismiss() {
      if (dismissed || card.classList.contains('exit')) return;
      dismissed = true;
      card.inert = true;
      if (typeof onDismiss === 'function') await onDismiss();
      requestAnimationFrame(() => {
        card.addEventListener('transitionend', onExitEnd);
        card.classList.add('exit');
        exitTimer = window.setTimeout(finishDismiss, 550);
      });
    }

    const skip = card.querySelector('.intro-skip');
    if (skip) skip.onclick = dismiss;

    function onKeyDown(event) {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (ready && !dismissed && !event.repeat && pendingKey === null) pendingKey = event.code || event.key;
    }

    function onKeyUp(event) {
      if ((event.code || event.key) !== pendingKey) return;
      event.preventDefault();
      event.stopPropagation();
      pendingKey = null;
      dismiss();
    }

    function onBlur() {
      pendingKey = null;
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);

    Promise.all([introFontsReady, animationDone]).then(() => {
      if (!card.isConnected || dismissed || card.classList.contains('exit')) return;
      card.removeAttribute('data-entry-intro');
      card.inert = false;
      if (instant) card.classList.add('instant-text');
      card.classList.add('text-ready');
      ready = true;
    }).catch(() => {
      if (!card.isConnected || dismissed || card.classList.contains('exit')) return;
      card.inert = false;
      card.classList.add('text-ready');
      ready = true;
    });

    return card;
  };
})();
