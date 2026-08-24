// Smooth scrolling
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

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

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => { if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) { e.preventDefault(); } });

window.addEventListener('load', () => { setTimeout(() => { const l = document.getElementById('loader'); if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 500); } }, 400); });

if (window.DHCMark) { window.DHCMark.ready.then(function(loaded) { if (loaded) window.DHCMark.updateFavicon(window.matchMedia('(prefers-color-scheme: dark)').matches); }); }