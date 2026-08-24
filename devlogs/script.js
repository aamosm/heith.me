document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => { 
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) { 
        e.preventDefault(); 
    } 
});

// Smooth scrolling by lenis
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

window.addEventListener('load', () => { 
    setTimeout(() => { 
        const l = document.getElementById('loader'); 
        if (l) { 
            l.classList.add('done'); 
            setTimeout(() => l.remove(), 500); 
        } 
    }, 400); 
});

if (window.DHCMark) { window.DHCMark.ready.then(function(loaded) { if (loaded) window.DHCMark.updateFavicon(window.matchMedia('(prefers-color-scheme: dark)').matches); }); }