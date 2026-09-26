let lenis = null;
let lenisFrame = 0;

function runScroll(time) {
    if (!lenis || document.hidden) { lenisFrame = 0; return; }
    lenis.raf(time);
    lenisFrame = requestAnimationFrame(runScroll);
}

function initSmoothScroll() {
    if (lenis || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true
    });
    if (window.DHCSite) window.DHCSite.scroller = lenis;
    const intro = document.getElementById('intro-card');
    if (intro && !intro.classList.contains('exit')) lenis.stop();
    lenisFrame = requestAnimationFrame(runScroll);
}

initSmoothScroll();
document.getElementById('lenis-script')?.addEventListener('load', initSmoothScroll, { once: true });
document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelAnimationFrame(lenisFrame); lenisFrame = 0; }
    else if (lenis && !lenisFrame) lenisFrame = requestAnimationFrame(runScroll);
});

(function () {
    const quiet = document.documentElement.dataset.pageEntry === 'quiet';
    const params = new URLSearchParams(location.search);
    if (quiet) {
        document.getElementById('intro-card')?.remove();
        if (lenis) lenis.start();
        params.delete('v');
        const query = params.toString();
        history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
        if (window.DHCMark) window.DHCMark.ready.then(function (loaded) {
            if (loaded) window.DHCMark.updateFavicon(matchMedia('(prefers-color-scheme: dark)').matches);
        });
        return;
    }
    let resolveAnimation;
    let animationFinished = false;
    let imageWait;
    const animationDone = new Promise(resolve => { resolveAnimation = resolve; });
    const card = window.showIntroOverlay ? window.showIntroOverlay(false, animationDone) : document.getElementById('intro-card');

    function finishAnimation() {
        if (animationFinished) return;
        animationFinished = true;
        clearTimeout(imageWait);
        resolveAnimation();
        if (!window.showIntroOverlay && card) {
            card.removeAttribute('data-entry-intro');
            card.inert = false;
            card.classList.add('text-ready');
        }
    }

    if (!window.DHCMark || !window.DHCGlassLoader) {
        finishAnimation();
        if (window.DHCMark) window.DHCMark.ready.then(function (loaded) {
            if (loaded) window.DHCMark.updateFavicon(matchMedia('(prefers-color-scheme: dark)').matches);
        });
        return;
    }

    imageWait = setTimeout(finishAnimation, 700);
    window.DHCMark.ready.then(function (loaded) {
        clearTimeout(imageWait);
        if (!loaded) { finishAnimation(); return; }
        if (animationFinished || !card?.isConnected || card.classList.contains('exit')) {
            window.DHCMark.updateFavicon(matchMedia('(prefers-color-scheme: dark)').matches);
            finishAnimation();
            return;
        }
        window.DHCGlassLoader.play(finishAnimation);
    }).catch(finishAnimation);
})();

document.querySelectorAll('.close-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
        window.close();
    });
});
