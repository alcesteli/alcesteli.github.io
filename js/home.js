// Aspect ratios and relative widths used to compute the expanded layout
const EXPANDED_SLIDE_CONFIGS = [
  { w: 28, ratio: [4, 3] },
  { w: 36, ratio: [16, 9] },
  { w: 24, ratio: [4, 3] },
  { w: 22, ratio: [4, 3] },
  { w: 18, ratio: [3, 4] }
];

// Collapsed pile: each entry is (% of element size, rotation, z-index, scale multiplier)
const COLLAPSED_LAYOUTS = [
  { x:   0, y:   2, rot:  -3, z: 5, sm: 1.00 },
  { x:  46, y: -22, rot:   9, z: 4, sm: 0.76 },
  { x: -50, y: -16, rot: -10, z: 3, sm: 0.80 },
  { x:  36, y:  34, rot:   7, z: 2, sm: 0.88 },
  { x: -32, y:  30, rot:  -8, z: 1, sm: 0.70 }
];

// Computes px-based expanded positions so rows never overlap regardless of viewport size.
// Row 1: slides 0–1 (top), Row 2: slides 2–4 (bottom).
// If total height exceeds available space, all slides shrink uniformly.
function computeExpandedLayout(trackW, trackH) {
  const gap = window.innerWidth <= 768 ? 14 : 28;

  const dims = EXPANDED_SLIDE_CONFIGS.map((c, i) => {
    const w = c.w / 100 * trackW;
    const nat = SLIDE_NATURAL_DIMS[i];
    const hRatio = nat ? nat.h / nat.w : c.ratio[1] / c.ratio[0];
    return { w, h: w * hRatio };
  });

  const r1H = Math.max(dims[0].h, dims[1].h);
  const r2H = Math.max(dims[2].h, dims[3].h, dims[4].h);
  const totalH = r1H + gap + r2H;

  if (totalH > trackH * 0.88) {
    const scale = (trackH * 0.88) / totalH;
    dims.forEach(d => { d.w *= scale; d.h *= scale; });
  }

  const sR1H = Math.max(dims[0].h, dims[1].h);
  const sR2H = Math.max(dims[2].h, dims[3].h, dims[4].h);
  const row1Y = -(gap / 2 + sR1H / 2);
  const row2Y =  (gap / 2 + sR2H / 2);

  const r1w = dims[0].w + gap + dims[1].w;
  const x0  = -(r1w / 2 - dims[0].w / 2);
  const x1  =   r1w / 2 - dims[1].w / 2;

  const r2w = dims[2].w + gap + dims[3].w + gap + dims[4].w;
  const r2s = -r2w / 2;
  const x2  = r2s + dims[2].w / 2;
  const x3  = r2s + dims[2].w + gap + dims[3].w / 2;
  const x4  = r2s + dims[2].w + gap + dims[3].w + gap + dims[4].w / 2;

  return [
    { tx: Math.round(x0), ty: Math.round(row1Y), w: Math.round(dims[0].w) },
    { tx: Math.round(x1), ty: Math.round(row1Y), w: Math.round(dims[1].w) },
    { tx: Math.round(x2), ty: Math.round(row2Y), w: Math.round(dims[2].w) },
    { tx: Math.round(x3), ty: Math.round(row2Y), w: Math.round(dims[3].w) },
    { tx: Math.round(x4), ty: Math.round(row2Y), w: Math.round(dims[4].w) }
  ];
}

function setHomeExpandedState(expanded) {
  homeExpanded = Boolean(expanded);
  track.classList.toggle('is-expanded', homeExpanded);
}

function getHomeSlideData(cfg) {
  if (cfg.project) {
    const p = DATA[cfg.project.cat].items[cfg.project.idx];
    return {
      title: cfg.title || p.title,
      image: cfg.image || p.cover || (p.images && p.images[0]) || '',
      click: () => openProject(cfg.project.cat, cfg.project.idx)
    };
  }
  return {
    title: cfg.title || '',
    image: cfg.image || '',
    click: null
  };
}

function renderHomeSlider() {
  track.innerHTML = '';

  const trackW = track.offsetWidth > 0 ? track.offsetWidth : window.innerWidth;
  const trackH = track.offsetHeight > 0 ? track.offsetHeight : window.innerHeight;
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const targetCollapsedPx = Math.max(280, Math.min(vmin * 0.56, 620));
  const expLayout = computeExpandedLayout(trackW, trackH);

  HOME_SLIDES.forEach((cfg, i) => {
    const item = getHomeSlideData(cfg);
    const slide = document.createElement('div');
    slide.className = 'h-slide';
    const cl = COLLAPSED_LAYOUTS[i % COLLAPSED_LAYOUTS.length];
    const ex = expLayout[i];

    const collapsedScale = (ex.w > 0 ? Math.min(1.5, targetCollapsedPx / ex.w) : 1.0) * cl.sm;

    slide.style.setProperty('--tx-collapsed', `${cl.x}%`);
    slide.style.setProperty('--ty-collapsed', `${cl.y}%`);
    slide.style.setProperty('--scale-collapsed', String(collapsedScale.toFixed(4)));
    slide.style.setProperty('--rot-collapsed', `${cl.rot}deg`);
    slide.style.setProperty('--z-collapsed', String(cl.z));
    slide.style.setProperty('--tx-expanded', `${ex.tx}px`);
    slide.style.setProperty('--ty-expanded', `${ex.ty}px`);
    slide.style.setProperty('--scale-expanded', '1');
    slide.style.setProperty('--z-expanded', String(HOME_SLIDES.length - i));
    slide.style.width = `${ex.w}px`;
    slide.dataset.index = String(i);

    const imgSrc = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || 'Featured image')}" />`
      : `<div class="ph">Coming Soon</div>`;
    slide.innerHTML = `<div class="h-slide-img-wrap">${imgSrc}</div><div class="h-slide-title">${escapeHtml(item.title)}</div>`;

    if (item.image) {
      const img = slide.querySelector('img');
      const slideIdx = i;
      const onImgLoad = () => {
        if (!img.naturalWidth) return;
        const prev = SLIDE_NATURAL_DIMS[slideIdx];
        if (!prev || prev.w !== img.naturalWidth || prev.h !== img.naturalHeight) {
          SLIDE_NATURAL_DIMS[slideIdx] = { w: img.naturalWidth, h: img.naturalHeight };
          if (!rerenderPending) {
            rerenderPending = true;
            requestAnimationFrame(() => {
              rerenderPending = false;
              if (document.getElementById('pg-home').classList.contains('on')) {
                const wasExpanded = homeExpanded;
                renderHomeSlider();
                if (wasExpanded) setHomeExpandedState(true);
              }
            });
          }
        }
      };
      if (img.complete && img.naturalWidth) {
        onImgLoad();
      } else {
        img.addEventListener('load', onImgLoad, { once: true });
      }
    }

    slide.addEventListener('click', event => {
      event.stopPropagation();
      if (!homeExpanded) {
        setHomeExpandedState(true);
        return;
      }
      if (item.click) item.click();
    });
    track.appendChild(slide);
  });

  track.onclick = event => {
    if (event.target !== track) return;
    setHomeExpandedState(!homeExpanded);
  };
  setHomeExpandedState(false);
}

window.addEventListener('resize', () => {
  if (document.getElementById('pg-home').classList.contains('on')) {
    renderHomeSlider();
  }
});
