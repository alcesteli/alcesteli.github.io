// Aspect ratios and relative widths used to compute the expanded layout
const EXPANDED_SLIDE_CONFIGS = [
  { w: 26, ratio: [4, 3] },
  { w: 22, ratio: [4, 3] },
  { w: 28, ratio: [16, 9] },
  { w: 22, ratio: [4, 3] },
  { w: 26, ratio: [4, 3] },
  { w: 18, ratio: [3, 4] }
];

// Collapsed pile: each entry is (% of element size, rotation, z-index, scale multiplier)
const COLLAPSED_LAYOUTS = [
  { x:   0, y:   2, rot:  -3, z: 5, sm: 1.00 },
  { x:  46, y: 118, rot:   -6, z: 4, sm: 0.86 },
  { x:  46, y: -48, rot:   9, z: 4, sm: 0.56 },
  { x: -50, y: -35, rot: -10, z: 3, sm: 0.80 },
  { x:  -36, y:  140, rot:   7, z: 2, sm: 1.00 },
  { x: -32, y:  170, rot:  -8, z: 1, sm: 1.00 }
];

// Computes px-based expanded positions so rows never overlap regardless of viewport size.
// Slides are split into two rows; row 1 = floor(N/2), row 2 = ceil(N/2).
// If total height or row width exceeds available space, all slides shrink uniformly.
function computeExpandedLayout(trackW, trackH) {
  const gap = window.innerWidth <= 768 ? 14 : 28;
  const N = HOME_SLIDES.length;
  const row1Count = Math.floor(N / 2);
  const row2Count = N - row1Count;

  const dims = [];
  for (let i = 0; i < N; i++) {
    const c = EXPANDED_SLIDE_CONFIGS[i % EXPANDED_SLIDE_CONFIGS.length];
    const w = c.w / 100 * trackW;
    const nat = SLIDE_NATURAL_DIMS[i];
    const hRatio = nat ? nat.h / nat.w : c.ratio[1] / c.ratio[0];
    dims.push({ w, h: w * hRatio });
  }

  const row1Dims = dims.slice(0, row1Count);
  const row2Dims = dims.slice(row1Count);

  const rowWidth = (rd) => rd.reduce((s, d) => s + d.w, 0) + gap * Math.max(0, rd.length - 1);
  const rowHeight = (rd) => rd.reduce((m, d) => Math.max(m, d.h), 0);

  const maxRowW = Math.max(rowWidth(row1Dims), rowWidth(row2Dims));
  if (maxRowW > trackW * 0.94) {
    const scale = (trackW * 0.94) / maxRowW;
    dims.forEach(d => { d.w *= scale; d.h *= scale; });
  }

  const totalH = rowHeight(row1Dims) + gap + rowHeight(row2Dims);
  if (totalH > trackH * 0.88) {
    const scale = (trackH * 0.88) / totalH;
    dims.forEach(d => { d.w *= scale; d.h *= scale; });
  }

  const sR1H = rowHeight(row1Dims);
  const sR2H = rowHeight(row2Dims);
  const row1Y = row1Count > 0 ? -(gap / 2 + sR1H / 2) : 0;
  const row2Y =  (gap / 2 + sR2H / 2);

  const placeRow = (rd, y) => {
    const rw = rowWidth(rd);
    let cursor = -rw / 2;
    return rd.map(d => {
      const tx = cursor + d.w / 2;
      cursor += d.w + gap;
      return { tx: Math.round(tx), ty: Math.round(y), w: Math.round(d.w) };
    });
  };

  return [...placeRow(row1Dims, row1Y), ...placeRow(row2Dims, row2Y)];
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
