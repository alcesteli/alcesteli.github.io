function loadProjectImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      try {
        if (img.decode) await img.decode();
      } catch (_) {}
      resolve(src);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function createProjectImage(src, index, isHero) {
  const wrap = document.createElement('div');
  wrap.className = isHero ? 'proj-hero' : 'proj-img-wrap';
  const loader = document.createElement('div');
  loader.className = 'proj-loading';
  wrap.appendChild(loader);

  const img = document.createElement('img');
  img.className = 'proj-img';
  img.alt = '';
  img.loading = index <= 1 ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.onclick = () => openLightbox(index);
  img.onload = async () => {
    try {
      if (img.decode) await img.decode();
    } catch (_) {}
    loader.remove();
    requestAnimationFrame(() => img.classList.add('is-ready'));
  };
  img.onerror = () => {
    loader.remove();
    img.remove();
    wrap.innerHTML = `<div class="ph">${escapeHtml(getUiText('system.imageUnavailable'))}</div>`;
  };
  wrap.appendChild(img);
  img.src = src;

  return { wrap, img };
}

function highlightSidebarItem(cat, idx) {
  document.querySelectorAll('.s-item.on').forEach(el => el.classList.remove('on'));
  const activeItem = document.getElementById(`si-${cat}-${idx}`);
  if (activeItem) activeItem.classList.add('on');
  const catHead = document.querySelector(`.s-cat-head[data-cat="${cat}"]`);
  if (catHead) catHead.classList.remove('closed');
}

function renderProjectInfo(cat, idx) {
  const p = DATA[cat].items[idx];
  document.getElementById('p-cat').innerText = DATA[cat].label;
  document.getElementById('p-title').innerText = p.title;
  document.getElementById('p-desc').innerHTML = sanitizeRichText(p.desc);
  document.getElementById('p-meta').innerHTML = `
    <div class="proj-meta-row"><span class="proj-meta-label">${escapeHtml(getUiText('projectMeta.type'))}</span><span>${escapeHtml(p.type)}</span></div>
    <div class="proj-meta-row"><span class="proj-meta-label">${escapeHtml(getUiText('projectMeta.client'))}</span><span>${escapeHtml(p.client)}</span></div>
    <div class="proj-meta-row"><span class="proj-meta-label">${escapeHtml(getUiText('projectMeta.year'))}</span><span>${escapeHtml(p.year)}</span></div>
  `;
}

function loadAndRenderImages(images, renderToken) {
  const hero = document.getElementById('p-hero');
  const gallery = document.getElementById('p-gallery');
  hero.innerHTML = '';
  gallery.innerHTML = '';

  if (images.length === 0) {
    hero.innerHTML = `<div class="ph">${escapeHtml(getUiText('system.noImage'))}</div>`;
    return;
  }

  hero.innerHTML = '<div class="proj-loading"></div>';

  loadProjectImage(images[0])
    .then(() => {
      if (renderToken !== projectRenderToken) return;
      const heroImage = createProjectImage(images[0], 0, true);
      hero.innerHTML = '';
      hero.appendChild(heroImage.wrap);
      for (let k = 1; k < images.length; k++) {
        if (renderToken !== projectRenderToken) return;
        gallery.appendChild(createProjectImage(images[k], k, false).wrap);
      }
    })
    .catch(() => {
      if (renderToken !== projectRenderToken) return;
      hero.innerHTML = `<div class="ph">${escapeHtml(getUiText('system.imageUnavailable'))}</div>`;
    });
}

function openProject(cat, idx) {
  currentProjectState = { cat, idx };
  currentProjImages = DATA[cat].items[idx].images || [];
  projectRenderToken += 1;
  closeLightbox();
  highlightSidebarItem(cat, idx);
  renderProjectInfo(cat, idx);
  showPage('project');
  loadAndRenderImages(currentProjImages, projectRenderToken);
}

function openLightbox(index) {
  lbIndex = index;
  const lb = document.getElementById('lightbox');
  lb.classList.add('on');
  if (currentProjImages.length <= 1) lb.classList.add('single-img');
  else lb.classList.remove('single-img');
  updateLightboxImg();
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('on');
}

function updateLightboxImg() {
  document.getElementById('lb-img').src = currentProjImages[lbIndex];
}

function changeLightboxImg(step) {
  lbIndex = (lbIndex + step + currentProjImages.length) % currentProjImages.length;
  updateLightboxImg();
}

document.addEventListener('keydown', e => {
  if (!document.getElementById('lightbox').classList.contains('on')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') changeLightboxImg(1);
  if (e.key === 'ArrowLeft') changeLightboxImg(-1);
});

(function () {
  let touchStartX = null;
  const lb = document.getElementById('lightbox');

  lb.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  lb.addEventListener('touchend', e => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 40) return;
    changeLightboxImg(dx < 0 ? 1 : -1);
  }, { passive: true });

  lb.addEventListener('touchcancel', () => { touchStartX = null; });
})();
