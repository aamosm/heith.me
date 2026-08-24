document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) { e.preventDefault(); }
});

window.addEventListener('load', () => {
    setTimeout(() => {
        const l = document.getElementById('loader');
        if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 500); }
    }, 400);
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function hexToRgb01(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255
    ];
}

function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
    c = clamp01(c);
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// Björn Ottosson's OKLab matrices — linear sRGB -> LMS -> OKLab
function linearRgbToOklab(r, g, b) {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    ];
}

function oklabToLinearRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    return [
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
}

function hexToOklch(hex) {
    const [r, g, b] = hexToRgb01(hex);
    const [L, a, bb] = linearRgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
    const C = Math.sqrt(a * a + bb * bb);
    let H = Math.atan2(bb, a) * 180 / Math.PI;
    if (H < 0) H += 360;
    return { L, C, H };
}

function oklchToRgb255(L, C, H) {
    const hRad = H * Math.PI / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);
    const [rl, gl, bl] = oklabToLinearRgb(L, a, b);
    return [
        Math.round(linearToSrgb(rl) * 255),
        Math.round(linearToSrgb(gl) * 255),
        Math.round(linearToSrgb(bl) * 255)
    ];
}

function lerpHue(h1, h2, t) {
    const diff = ((((h2 - h1) % 360) + 540) % 360) - 180;
    return (h1 + diff * t + 360) % 360;
}


function mixOklch(hexFrom, hexTo, t) {
    const from = hexToOklch(hexFrom);
    const to = hexToOklch(hexTo);
    const CHROMA_EPSILON = 0.0001;
    const fromHue = from.C < CHROMA_EPSILON ? to.H : from.H;
    const toHue = to.C < CHROMA_EPSILON ? from.H : to.H;
    const L = from.L + (to.L - from.L) * t;
    const C = from.C + (to.C - from.C) * t;
    const H = lerpHue(fromHue, toHue, t);
    const [r, g, b] = oklchToRgb255(L, C, H);
    return { rgb: `rgb(${r}, ${g}, ${b})`, rgbArr: [r, g, b], L, C, H };
}

function hexToRgbCss(hex) {
    const [r, g, b] = hexToRgb01(hex).map((c) => Math.round(c * 255));
    return `rgb(${r}, ${g}, ${b})`;
}

function relativeLuminance255([r, g, b]) {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio255(rgbA, rgbB) {
    const a = relativeLuminance255(rgbA), b = relativeLuminance255(rgbB);
    const lighter = Math.max(a, b), darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
}

function solveTextColor(bgL, bgRgbArr, hue, chroma, targetContrast, direction) {
    let lo = direction === 'darker' ? 0 : bgL;
    let hi = direction === 'darker' ? bgL : 1;
    let best = direction === 'darker' ? [0, 0, 0] : [255, 255, 255];
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const candidate = oklchToRgb255(mid, chroma, hue);
        const cr = contrastRatio255(candidate, bgRgbArr);
        if (cr >= targetContrast) {
            best = candidate;
            if (direction === 'darker') lo = mid; else hi = mid;
        } else {
            if (direction === 'darker') hi = mid; else lo = mid;
        }
    }
    return `rgb(${best[0]}, ${best[1]}, ${best[2]})`;
}

function oklabDelta(colorA, colorB) {
    const a1 = colorA.C * Math.cos(colorA.H * Math.PI / 180);
    const b1 = colorA.C * Math.sin(colorA.H * Math.PI / 180);
    const a2 = colorB.C * Math.cos(colorB.H * Math.PI / 180);
    const b2 = colorB.C * Math.sin(colorB.H * Math.PI / 180);
    return Math.sqrt((colorA.L - colorB.L) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}


const SINGULARITY = {
    trackA: '#ffffff',
    trackB: '#000000',
    convergeColor: '#c1272d'
};

const EASE_POWER = 3;
const INK_CHROMA_FACTOR = 0.42;
const INK_TARGET_CONTRAST = 5.5;
const FLAG_CHROMA_FACTOR = 0.75;
const FLAG_CHROMA_FLOOR = 0.10;
const FLAG_TARGET_CONTRAST = 6.5;

function applySingularityBackgrounds() {
    const pages = document.querySelectorAll('.doc-page');
    if (!pages.length) return;

    const trackACount = Math.ceil(pages.length / 2);
    const trackBCount = Math.floor(pages.length / 2);
    let aSeen = 0, bSeen = 0;
    const sequenceColors = [];

    let lastA = { rgb: hexToRgbCss(SINGULARITY.trackA), ...hexToOklch(SINGULARITY.trackA) };
    let lastB = { rgb: hexToRgbCss(SINGULARITY.trackB), ...hexToOklch(SINGULARITY.trackB) };
    const maxDelta = oklabDelta(lastA, lastB) || 1;

    pages.forEach((page, i) => {
        const onTrackA = i % 2 === 0;
        const count = onTrackA ? trackACount : trackBCount;
        const index = onTrackA ? aSeen++ : bSeen++;
        const tLinear = count > 1 ? index / (count - 1) : 1;
        const t = Math.pow(tLinear, EASE_POWER);
        const start = onTrackA ? SINGULARITY.trackA : SINGULARITY.trackB;
        const direction = onTrackA ? 'darker' : 'lighter';

        const { rgb, rgbArr, L, C, H } = mixOklch(start, SINGULARITY.convergeColor, t);

        page.style.setProperty('background-color', rgb);
        page.classList.toggle('dark-page', !onTrackA);

        const inkChroma = C * INK_CHROMA_FACTOR;
        const ink = solveTextColor(L, rgbArr, H, inkChroma, INK_TARGET_CONTRAST, direction);
        page.style.setProperty('--muted', ink);

        const flagChroma = Math.max(C, FLAG_CHROMA_FLOOR) * FLAG_CHROMA_FACTOR;
        const flag = solveTextColor(L, rgbArr, H, flagChroma, FLAG_TARGET_CONTRAST, direction);
        page.style.setProperty('--flag', flag);
        page.style.setProperty('--page-ink', onTrackA ? '#000000' : '#ffffff');

        const thisColor = { rgb, L, C, H };
        if (onTrackA) lastA = thisColor; else lastB = thisColor;
        sequenceColors.push(rgb);

        const dotA = page.querySelector('.sync-dot-a');
        const dotB = page.querySelector('.sync-dot-b');
        const line = page.querySelector('.sync-line');
        if (dotA) dotA.style.background = lastA.rgb;
        if (dotB) dotB.style.background = lastB.rgb;
        if (line) {
            const frac = clamp01(oklabDelta(lastA, lastB) / maxDelta);
            line.style.width = `${(2 + frac * 28).toFixed(1)}px`;
            line.style.background = ink;
        }
    });

    const strip = document.getElementById('convergence-strip');
    if (strip) {
        strip.innerHTML = '';
        sequenceColors.forEach((rgb) => {
            const swatch = document.createElement('span');
            swatch.style.background = rgb;
            strip.appendChild(swatch);
        });
    }
}


function initDocNavigation() {
    const stage = document.getElementById('stage-container');
    const trackerList = document.getElementById('tracker-list');
    const sections = Array.from(document.querySelectorAll('.doc-page'));
    if (!stage || !trackerList || !sections.length) return;

    trackerList.querySelectorAll('.tracker-item').forEach(el => el.remove());
    const indicator = document.getElementById('tracker-indicator');

    const items = sections.map((sec, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tracker-item';
        btn.id = `track-${i}`;
        btn.innerHTML = `<span class="idx">/ 0${i + 1} /</span><span class="name">${sec.dataset.name || sec.dataset.title || ''}</span>`;
        btn.addEventListener('click', () => {
            if (window.__lenis) {
                window.__lenis.scrollTo(sec, { offset: -24 });
            } else {
                sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        trackerList.appendChild(btn);
        return btn;
    });

    const metaTitle = document.getElementById('meta-title');
    const metaDesc = document.getElementById('meta-desc');
    const metaCount = document.getElementById('meta-count');

    let activeIndex = -1;
    function setActive(i) {
        if (i === activeIndex) return;
        activeIndex = i;
        items.forEach((el, idx) => el.classList.toggle('active', idx === i));
        const sec = sections[i];
        if (!sec) return;
        if (metaTitle) metaTitle.innerText = sec.dataset.title || '';
        if (metaDesc) metaDesc.innerText = sec.dataset.desc || '';
        if (metaCount) metaCount.innerText = `0${i + 1} / 0${sections.length}`;
    }

    function update() {
        const stageRect = stage.getBoundingClientRect();
        const probe = stageRect.top + stageRect.height * 0.3;

        let current = 0;
        for (let i = 0; i < sections.length; i++) {
            const r = sections[i].getBoundingClientRect();
            if (r.top <= probe) current = i;
        }
        setActive(current);

        const maxScroll = stage.scrollHeight - stage.clientHeight;
        const frac = maxScroll > 0 ? clamp01(stage.scrollTop / maxScroll) : 0;
        if (indicator) {
            const listHeight = trackerList.clientHeight;
            indicator.style.transform = `translateY(${frac * (listHeight - 24)}px)`;
        }
    }

    stage.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
}


function initSmoothScroll() {
    const stage = document.getElementById('stage-container');
    const content = document.getElementById('doc');
    if (!window.Lenis || !stage || !content) return;

    const lenis = new window.Lenis({
        wrapper: stage,
        content: content,
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
    });
    window.__lenis = lenis;

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
}


const PIXELATE_BAND_HEIGHT = 180; 
const PIXELATE_STRIPS = 6;     
const PIXELATE_MIN_BLOCK = 2;  
const PIXELATE_MAX_BLOCK = 34; 
const PIXELATE_LEAD = PIXELATE_BAND_HEIGHT * 2;

function initPixelateExit() {
    const stage = document.getElementById('stage-container');
    const pages = Array.from(document.querySelectorAll('.doc-page'));
    if (!stage || !pages.length || typeof html2canvas === 'undefined') return;

    const entries = pages.map((page) => {
        const canvas = document.createElement('canvas');
        canvas.className = 'doc-page-pixelate';
        page.appendChild(canvas);

        const small = document.createElement('canvas'); // offscreen mosaic buffer

        return {
            page, canvas,
            ctx: canvas.getContext('2d'),
            small, smallCtx: small.getContext('2d'),
            snapshot: null, capturing: false
        };
    });

    function capture(entry) {
        if (entry.snapshot || entry.capturing) return;
        entry.capturing = true;
        html2canvas(entry.page, {
            backgroundColor: null,
            scale: Math.min(1.5, window.devicePixelRatio || 1),
            ignoreElements: (el) => el === entry.canvas
        }).then((snap) => {
            entry.snapshot = snap;
            entry.capturing = false;
        }).catch(() => { entry.capturing = false; });
    }
    function paintBand(entry, localTop, pageW, pageH) {
        const { canvas, ctx, small, smallCtx, snapshot } = entry;
        const bandTop = Math.max(0, localTop);
        const bandBottom = Math.min(pageH, localTop + PIXELATE_BAND_HEIGHT);
        const bandH = bandBottom - bandTop;
        if (bandH <= 0) { canvas.style.opacity = '0'; return; }

        const w = Math.max(1, Math.round(pageW));
        const h = Math.max(1, Math.round(bandH));
        canvas.style.top = `${bandTop}px`;
        canvas.style.height = `${h}px`;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        ctx.clearRect(0, 0, w, h);

        if (!snapshot) { canvas.style.opacity = '0'; return; }
        canvas.style.opacity = '1';

        const scaleY = snapshot.height / pageH;

        for (let i = 0; i < PIXELATE_STRIPS; i++) {
            const stripTop = localTop + (PIXELATE_BAND_HEIGHT * i) / PIXELATE_STRIPS;
            const stripBottom = localTop + (PIXELATE_BAND_HEIGHT * (i + 1)) / PIXELATE_STRIPS;
            const y0 = Math.max(bandTop, stripTop);
            const y1 = Math.min(bandBottom, stripBottom);
            if (y1 <= y0) continue;

            const block = Math.max(1, Math.round(
                PIXELATE_MAX_BLOCK - ((PIXELATE_MAX_BLOCK - PIXELATE_MIN_BLOCK) * i) / (PIXELATE_STRIPS - 1)
            ));

            const srcY0 = y0 * scaleY;
            const srcH = Math.max(1, (y1 - y0) * scaleY);
            const smallW = Math.max(1, Math.round(w / block));
            const smallH = Math.max(1, Math.round((y1 - y0) / block));
            if (small.width !== smallW || small.height !== smallH) {
                small.width = smallW; small.height = smallH;
            }
            smallCtx.imageSmoothingEnabled = true;
            smallCtx.clearRect(0, 0, smallW, smallH);
            smallCtx.drawImage(snapshot, 0, srcY0, snapshot.width, srcH, 0, 0, smallW, smallH);

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(small, 0, 0, smallW, smallH, 0, y0 - bandTop, w, y1 - y0);
        }
    }

    function update() {
        const stageTop = stage.getBoundingClientRect().top;
        entries.forEach((entry) => {
            const pageRect = entry.page.getBoundingClientRect();
            const pageH = entry.page.offsetHeight;
            const localTop = stageTop - pageRect.top; 

            if (localTop > -PIXELATE_LEAD && localTop < pageH && !entry.snapshot) {
                capture(entry);
            }

            if (localTop < 0 || localTop >= pageH) {
                entry.canvas.style.opacity = '0';
                return;
            }
            paintBand(entry, localTop, pageRect.width, pageH);
        });
    }

    stage.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', () => {
        entries.forEach((entry) => { entry.snapshot = null; });
        update();
    });
    update();
}

function initBrandReveal() {
    const stage = document.getElementById('stage-container');
    const brand = document.querySelector('header.top-nav .brand');
    const coverMark = document.querySelector('.doc-cover-mark');
    if (!brand) return;
    if (!stage || !coverMark) { brand.classList.add('visible'); return; }

    function update() {
        const stageTop = stage.getBoundingClientRect().top;
        const markBottom = coverMark.getBoundingClientRect().bottom;
        brand.classList.toggle('visible', markBottom <= stageTop);
    }

    stage.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
}

document.addEventListener('DOMContentLoaded', () => {
    applySingularityBackgrounds();
    initDocNavigation();
    initSmoothScroll();
    initPixelateExit();
    initBrandReveal();
});