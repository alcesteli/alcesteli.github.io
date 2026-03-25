let currentLang = localStorage.getItem('lang') || 'fr'; // Default: French
let translations = {};

// Load translations
async function loadTranslations() {
  try {
    const response = await fetch(`/data/${currentLang}.json`);
    translations = await response.json();
    applyTranslations();
  } catch (error) {
    console.error('Error loading translations:', error);
  }
}

// Switch language
function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  loadTranslations();
}

// Apply translations to DOM
function applyTranslations() {
  // Sidebar
  document.getElementById('sl-about').textContent = translations.sidebar.about;
  document.getElementById('sl-contact').textContent = translations.sidebar.contact;
  document.getElementById('menu-btn').textContent = translations.sidebar.menu;
  
  // About page
  const aboutSection = document.getElementById('pg-about');
  if (aboutSection) {
    aboutSection.innerHTML = `
      <div class="content-block">
        <p class="eyebrow">${translations.about.heading}</p>
        <div class="about-copy">
          ${translations.about.content.map(p => `<p>${p}</p>`).join('')}
        </div>
      </div>
    `;
  }
  
  // Contact page
  const contactSection = document.getElementById('pg-contact');
  if (contactSection) {
    contactSection.innerHTML = `
      <div class="content-block">
        <p class="eyebrow">Get in Touch</p>
        <h2 class="heading">${translations.contact.heading}</h2>
        <a href="mailto:contact@hidden.invalid" class="contact-email">contact@hidden.invalid</a>
        <div class="contact-links">
          <a href="https://www.instagram.com/clapciodonagua?igsh=MXh6YTN6OHd3NTB0aw%3D%3D&utm_source=qr" target="_blank" class="c-row"><span class="c-row-name">Instagram</span><span class="c-row-arr">&#8599;</span></a>
          <a href="https://www.behance.net/alceste_li" target="_blank" class="c-row"><span class="c-row-name">Behance</span><span class="c-row-arr">&#8599;</span></a>
        </div>
      </div>
    `;
  }
  
  // Language switcher - add if not exists
  if (!document.getElementById('lang-switcher')) {
    const switcher = document.createElement('div');
    switcher.id = 'lang-switcher';
    switcher.innerHTML = `
      <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" onclick="switchLanguage('en')">EN</button>
      <button class="lang-btn ${currentLang === 'fr' ? 'active' : ''}" onclick="switchLanguage('fr')">FR</button>
    `;
    document.body.appendChild(switcher);
  } else {
    // Update active button
    document.querySelectorAll('.lang-btn').forEach((btn, i) => {
      const lang = i === 0 ? 'en' : 'fr';
      btn.classList.toggle('active', currentLang === lang);
    });
  }
  
  // Update project meta labels
  const projMetaRows = document.querySelectorAll('.proj-meta-row');
  const metaLabels = [translations.projectMeta.type, translations.projectMeta.client, translations.projectMeta.year];
  projMetaRows.forEach((row, i) => {
    if (i < metaLabels.length) {
      const label = row.querySelector('.proj-meta-label');
      if (label) label.textContent = metaLabels[i];
    }
  });
  
  // Update sidebar categories and items
  rebuildSidebar();
}

// Rebuild sidebar with translated categories
function rebuildSidebar() {
  const sNav = document.getElementById('s-nav');
  sNav.innerHTML = '';
  
  Object.keys(DATA).forEach(catKey => {
    const translatedLabel = translations.categories[catKey] || DATA[catKey].label;
    const transItems = translations.projects[catKey]?.items || [];
    
    const group = document.createElement('div');
    group.innerHTML = `
      <div class="s-cat-head closed" data-cat="${catKey}" onclick="this.classList.toggle('closed')">${translatedLabel} <span class="s-cat-arr">▾</span></div>
      <div class="s-items">
        ${DATA[catKey].items.map((item, i) => {
          const transTitle = transItems[i]?.title || item.title;
          return `<div class="s-item" id="si-${catKey}-${i}" onclick="openProject('${catKey}', ${i})">${transTitle}</div>`;
        }).join('')}
      </div>
    `;
    sNav.appendChild(group);
  });
}

// Override openProject to use translated content
const originalOpenProject = window.openProject;
window.openProject = function(cat, idx) {
  const p = DATA[cat].items[idx];
  const transProject = translations.projects[cat]?.items[idx] || {};
  currentProjImages = p.images || [];

  // Highlight sidebar item and expand its category
  document.querySelectorAll('.s-item.on').forEach(el => el.classList.remove('on'));
  const activeItem = document.getElementById(`si-${cat}-${idx}`);
  if (activeItem) activeItem.classList.add('on');
  const catHead = document.querySelector(`.s-cat-head[data-cat="${cat}"]`);
  if (catHead) catHead.classList.remove('closed');

  // Hero Image
  document.getElementById('p-hero').innerHTML = currentProjImages.length > 0 
    ? `<img src="${currentProjImages[0]}" onclick="openLightbox(0)" />` 
    : `<div class="ph">No Image</div>`;
  
  // Gallery
  let galleryHtml = '';
  for (let k = 1; k < currentProjImages.length; k++) {
    galleryHtml += `<div class="proj-img-wrap"><img src="${currentProjImages[k]}" onclick="openLightbox(${k})" /></div>`;
  }
  document.getElementById('p-gallery').innerHTML = galleryHtml;

  document.getElementById('p-cat').innerText = translations.categories[cat] || DATA[cat].label;
  document.getElementById('p-title').innerText = transProject.title || p.title;
  document.getElementById('p-desc').innerHTML = transProject.desc || p.desc;
  document.getElementById('p-meta').innerHTML = `
    <div class="proj-meta-row"><span class="proj-meta-label">${translations.projectMeta.type}</span><span>${p.type}</span></div>
    <div class="proj-meta-row"><span class="proj-meta-label">${translations.projectMeta.client}</span><span>${p.client}</span></div>
    <div class="proj-meta-row"><span class="proj-meta-label">${translations.projectMeta.year}</span><span>${p.year}</span></div>
  `;
  showPage('project');
};

// Load translations on page load
document.addEventListener('DOMContentLoaded', loadTranslations);
