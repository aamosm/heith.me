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

const images = [
    "../assets/projects/proj_01.png",
    "../assets/projects/proj_02.jpg",
    "../assets/projects/proj_03.png",
    "../assets/projects/proj_04.png",
    "../assets/projects/proj_05.png",
    "../assets/projects/proj_06.png",
    "../assets/projects/proj_07.png",
    "../assets/projects/proj_08.png",
    "../assets/projects/proj_09.png",
    "../assets/projects/proj_10.png",
    "../assets/projects/proj_11.png",
    "../assets/projects/proj_12.png",
    "../assets/projects/proj_13.png",
    "../assets/projects/proj_14.png",
    "../assets/projects/proj_15.png",
    "../assets/projects/proj_16.png",
    "../assets/projects/proj_17.png",
    "../assets/projects/proj_18.png",
    "../assets/projects/proj_19.png",
    "../assets/projects/proj_20.png",
    "../assets/projects/proj_21.png",
    "../assets/projects/proj_22.png",
    "../assets/projects/proj_23.png",
    "../assets/projects/proj_24.jpg",
    "../assets/projects/proj_25.jpg"
];

const createArtworkMarkup = () => {
    const shuffled = [...images].sort(() => 0.5 - Math.random());
    return shuffled.map(src => `
        <div class="artwork-card">
            <img src="${src}" loading="lazy" alt="Archival Asset" />
        </div>
    `).join('');
};

const track1 = document.getElementById('track-1');
const track2 = document.getElementById('track-2');
const track3 = document.getElementById('track-3');

if (track1) track1.innerHTML = createArtworkMarkup() + createArtworkMarkup();
if (track2) track2.innerHTML = createArtworkMarkup() + createArtworkMarkup();
if (track3) track3.innerHTML = createArtworkMarkup() + createArtworkMarkup();


document.querySelectorAll('.close-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
        window.close();
    });
});
