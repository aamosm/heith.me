# heith.me

Personal portfolio site. Built with vanilla HTML, CSS, and JavaScript. No frameworks, no build tools, and only a couple of external dependencies for fonts and smooth scrolling. The full visual treatment is enabled on every device; actual smoothness depends on the browser and hardware.

<p align="center">

  <a href="https://github.com/aamosm/heith.me">
    <img src="assets/portfolio/landing.jpg" alt="heith.me landing page">
  </a>

</p>

## Why I Built It This Way

I wanted the site itself to be part of the work I was showing. So the animations, layout, video syncing, animation scheduling and the little browser-specific things all live in the project.

This also meant I had to deal with all the small problems that come with putting all of those things together. That ended up being a big part of the project.

The portfolio is also one of the pieces in the portfolio. It is the site I built to put the rest of my work, process and projects together for me to look at. and if you are here then you too.

## What It Does

The landing page is made from overlapping paper panels with torn edges and noise textures, with a looping video underneath. As you scroll, the panels peel back and reveal more of the CRT footage underneath.

The Design, Devlogs and Projects links sit directly over the video using `mix-blend-mode: difference`. Since the video is constantly changing, the text colour changes with it. A sync script selects authored colour keyframes from the video playback time, keeping the text and its coloured outlines in step with the reel.

The right panel is `#0D1117`, the same dark background I use on Github. Clicking "site src" expands the panel and takes you to the repository, with the same colour carrying through.

Design, Devlogs and Projects each have their own colour palette. They still share the same navbar and CRT layer.

### Full Visuals

There are no hardware, network or reduced-motion quality tiers. The original palette, blend modes, coloured outlines, full-resolution reel, scanlines, refresh sweep and glass intro stay enabled. Narrow screens retain their responsive layout and get the same CRT treatment, favicon flight and paper transition to the repository.

The cursor follows mouse or pen input, including on devices that also have a touchscreen. Touch alone does not draw a fake mouse pointer.

The video source and Lenis dependency are discovered directly from the HTML. Paper texture is generated at its original detail and reused for the rest of the tab's session. Cursor position work stops when it settles, while the shape continues to morph. Hidden tabs pause video and the smooth-scroll loop.

Browser autoplay restrictions and failed asset requests are still handled so the loader cannot trap the page. These do not select a lower-quality video or a simpler theme.

### Updates and Commits

I work on this site in large updates rather than small, frequent commits. That is simply how I want it to be. This is my personal site, and I only publish changes when I am entirely happy with them. Therefore, you will mostly see large reworks unlike my other projects.

### Hosting and 404s

Internal links and assets remain relative. `404.html` finds the homepage by checking parent `index.html` files for the `dhc-site-root` meta tag. It needs no hard-coded domain or repository name and works at a domain root or a repository subpath. Keep that marker in the landing page.

The repository transition keeps the current page URL until it leaves for GitHub, so refresh and Back no longer encounter fabricated local paths. Put these files at the existing site's publishing root. Configure the custom domain and DNS in GitHub Pages separately.

### The Custom Cursor

The cursor is a blob that replaces the normal pointer. It trails behind the mouse with some lag and stretches in the direction it is moving based on its velocity.

The cursor behaviour is adapted from [Xenobiota](https://xenobiota.vercel.app/) by tol-is. The [source](https://github.com/tol-is/xenobiota) is here. I only use the cursor blob behaviour. The full creature system is not part of this site.

### The Favicon

The browser tab starts blank using an inline 1×1 transparent GIF.

During the loading screen, a glass-like favicon appears, moves upward and lands in the browser tab slot. I liked the idea of having something move from the page into the browser itself.

## Things I Looked At

* [xenobiota.vercel.app](https://xenobiota.vercel.app/) by tol-is: cursor blob

* [rithunyaa.github.io](https://rithunyaa.github.io/personal_website2/): layout and presentation

* [pxlin.space](https://pxlin.space/): interaction design

* [sandeep.ramgolam.com](https://sandeep.ramgolam.com/): portfolio structure

* [acid-crunch.com](https://acid-crunch.com/): CRT effects and visual style

* [artemartemartem.com](https://artemartemartem.com/): typography and the video reveal idea